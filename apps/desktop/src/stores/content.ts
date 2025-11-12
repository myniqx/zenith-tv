import { create } from 'zustand';
import type { WatchableItem } from '@zenith-tv/types';
import { m3uService } from '../services/m3u-service';
import { userDataService } from '../services/user-data-service';
import { parseM3U } from '../services/m3u-parser';
import { mergeItemsWithUserData, secondsToProgress } from '../lib/item-helpers';
import { useToastStore } from './toast';

export type CategoryType = 'all' | 'movies' | 'series' | 'live' | 'favorites' | 'recent';
export type SortBy = 'name' | 'date' | 'recent';
export type SortOrder = 'asc' | 'desc';

export interface SeriesGroup {
  seriesName: string;
  episodes: WatchableItem[];
  totalEpisodes: number;
}

interface ContentState {
  items: WatchableItem[];
  recentItems: WatchableItem[];
  favoritesItems: WatchableItem[];
  currentCategory: CategoryType;
  searchQuery: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  isLoading: boolean;
  currentUsername: string | null;
  currentUUID: string | null;

  // Actions
  loadItems: (username: string, uuid: string) => Promise<void>;
  loadRecent: (username: string, uuid: string) => Promise<void>;
  loadFavorites: (username: string, uuid: string) => Promise<void>;
  setCategory: (category: CategoryType) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: SortBy) => void;
  setSortOrder: (order: SortOrder) => void;
  getFilteredItems: () => WatchableItem[];
  toggleFavorite: (url: string) => Promise<void>;
  saveWatchProgress: (url: string, position: number, duration: number) => Promise<void>;
  clearItems: () => void;

  // Series helpers
  getSeriesGroups: () => SeriesGroup[];
  getEpisodesForSeries: (seriesName: string) => WatchableItem[];
  getNextEpisode: (currentItem: WatchableItem) => WatchableItem | null;
  getPreviousEpisode: (currentItem: WatchableItem) => WatchableItem | null;
}

export const useContentStore = create<ContentState>((set, get) => ({
  items: [],
  recentItems: [],
  favoritesItems: [],
  currentCategory: 'all',
  searchQuery: '',
  sortBy: 'name',
  sortOrder: 'asc',
  isLoading: false,
  currentUsername: null,
  currentUUID: null,

  loadItems: async (username, uuid) => {
    set({ isLoading: true, currentUsername: username, currentUUID: uuid });
    try {
      // Load M3U source
      const content = await m3uService.loadSource(uuid);

      // Parse M3U content
      const parsedItems = await parseM3U(content);

      // Load user data for these items
      const userDataMap = await userDataService.get(username, uuid);

      // Merge items with user data
      const items = mergeItemsWithUserData(parsedItems, userDataMap);

      set({ items });

      // Also load recent and favorites
      await get().loadRecent(username, uuid);
      await get().loadFavorites(username, uuid);
    } catch (error) {
      console.error('Failed to load items:', error);
      useToastStore.getState().error('Failed to load items');
    } finally {
      set({ isLoading: false });
    }
  },

  loadRecent: async (username, uuid) => {
    try {
      const recent = await userDataService.getAllRecentlyWatched(username, [uuid], 50);

      // Get items and merge with recent data
      const { items } = get();
      const recentItems = recent
        .map((recentData: any) => {
          const item = items.find((i) => i.url === recentData.url);
          return item;
        })
        .filter((item): item is WatchableItem => item !== undefined);

      set({ recentItems });
    } catch (error) {
      console.error('Failed to load recent items:', error);
    }
  },

  loadFavorites: async (username, uuid) => {
    try {
      const favorites = await userDataService.getAllFavorites(username, [uuid]);

      // Get items and filter favorites
      const { items } = get();
      const favoritesItems = items.filter((item) => item.isFavorite);

      set({ favoritesItems });
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  },

  setCategory: (category) => set({ currentCategory: category }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSortBy: (sortBy) => set({ sortBy }),

  setSortOrder: (order) => set({ sortOrder: order }),

  getFilteredItems: () => {
    const { items, recentItems, favoritesItems, currentCategory, searchQuery, sortBy, sortOrder } = get();

    // Step 1: Filter by category
    let filtered: WatchableItem[] = [];
    switch (currentCategory) {
      case 'all':
        filtered = items;
        break;
      case 'movies':
        filtered = items.filter((item) => item.category.type === 'movie');
        break;
      case 'series':
        filtered = items.filter((item) => item.category.type === 'series');
        break;
      case 'live':
        filtered = items.filter((item) => item.category.type === 'live_stream');
        break;
      case 'favorites':
        filtered = favoritesItems;
        break;
      case 'recent':
        filtered = recentItems;
        break;
      default:
        filtered = items;
    }

    // Step 2: Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) =>
        item.title.toLowerCase().includes(query) ||
        item.group?.toLowerCase().includes(query)
      );
    }

    // Step 3: Sort items
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'date':
          comparison = new Date(a.addedDate).getTime() - new Date(b.addedDate).getTime();
          break;
        case 'recent':
          if (a.watchHistory && b.watchHistory) {
            comparison = new Date(b.watchHistory.lastWatched).getTime() - new Date(a.watchHistory.lastWatched).getTime();
          } else if (a.watchHistory) {
            comparison = -1;
          } else if (b.watchHistory) {
            comparison = 1;
          }
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  },

  toggleFavorite: async (url) => {
    const { currentUsername, currentUUID } = get();
    if (!currentUsername || !currentUUID) return;

    try {
      const isFavorite = await userDataService.toggleFavorite(currentUsername, currentUUID, url);

      // Update local state
      set((state) => ({
        items: state.items.map((item) =>
          item.url === url ? { ...item, isFavorite } : item
        ),
      }));

      // Reload favorites list
      await get().loadFavorites(currentUsername, currentUUID);

      // Show toast notification
      if (isFavorite) {
        useToastStore.getState().success('Added to favorites');
      } else {
        useToastStore.getState().info('Removed from favorites');
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      useToastStore.getState().error('Failed to update favorite');
    }
  },

  saveWatchProgress: async (url, position, duration) => {
    const { currentUsername, currentUUID } = get();
    if (!currentUsername || !currentUUID) return;

    try {
      // Convert seconds to progress percentage
      const progress = secondsToProgress(position, duration);

      // Save progress
      const userData = await userDataService.updateWatchProgress(
        currentUsername,
        currentUUID,
        url,
        progress
      );

      // Update local state
      set((state) => ({
        items: state.items.map((item) =>
          item.url === url
            ? {
                ...item,
                watchHistory: {
                  lastWatched: new Date(),
                  position: progress,
                  duration: 100, // Percentage-based
                },
              }
            : item
        ),
      }));

      // Reload recent list
      await get().loadRecent(currentUsername, currentUUID);
    } catch (error) {
      console.error('Failed to save watch progress:', error);
    }
  },

  clearItems: () => {
    set({
      items: [],
      recentItems: [],
      favoritesItems: [],
      currentUsername: null,
      currentUUID: null,
      searchQuery: '',
      sortBy: 'name',
      sortOrder: 'asc',
    });
  },

  getSeriesGroups: () => {
    const { items } = get();
    const seriesItems = items.filter((item) => item.category.type === 'series');

    // Group by series name
    const groups = new Map<string, WatchableItem[]>();
    seriesItems.forEach((item) => {
      if (item.category.type === 'series') {
        const seriesName = item.category.episode.seriesName;
        if (!groups.has(seriesName)) {
          groups.set(seriesName, []);
        }
        groups.get(seriesName)!.push(item);
      }
    });

    // Convert to SeriesGroup array and sort episodes
    return Array.from(groups.entries()).map(([seriesName, episodes]) => {
      const sortedEpisodes = [...episodes].sort((a, b) => {
        if (a.category.type === 'series' && b.category.type === 'series') {
          const seasonDiff = a.category.episode.season - b.category.episode.season;
          if (seasonDiff !== 0) return seasonDiff;
          return a.category.episode.episode - b.category.episode.episode;
        }
        return 0;
      });

      return {
        seriesName,
        episodes: sortedEpisodes,
        totalEpisodes: sortedEpisodes.length,
      };
    }).sort((a, b) => a.seriesName.localeCompare(b.seriesName));
  },

  getEpisodesForSeries: (seriesName) => {
    const { items } = get();
    const episodes = items.filter(
      (item) =>
        item.category.type === 'series' &&
        item.category.episode.seriesName === seriesName
    );

    // Sort by season and episode
    return episodes.sort((a, b) => {
      if (a.category.type === 'series' && b.category.type === 'series') {
        const seasonDiff = a.category.episode.season - b.category.episode.season;
        if (seasonDiff !== 0) return seasonDiff;
        return a.category.episode.episode - b.category.episode.episode;
      }
      return 0;
    });
  },

  getNextEpisode: (currentItem) => {
    if (currentItem.category.type !== 'series') return null;

    const episodes = get().getEpisodesForSeries(currentItem.category.episode.seriesName);
    const currentIndex = episodes.findIndex((ep) => ep.url === currentItem.url);

    if (currentIndex === -1 || currentIndex === episodes.length - 1) {
      return null;
    }

    return episodes[currentIndex + 1];
  },

  getPreviousEpisode: (currentItem) => {
    if (currentItem.category.type !== 'series') return null;

    const episodes = get().getEpisodesForSeries(currentItem.category.episode.seriesName);
    const currentIndex = episodes.findIndex((ep) => ep.url === currentItem.url);

    if (currentIndex <= 0) {
      return null;
    }

    return episodes[currentIndex - 1];
  },
}));
