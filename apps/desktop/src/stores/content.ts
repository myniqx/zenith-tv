import { create } from 'zustand';
import { userDataService } from '../services/user-data-service';
import { parseM3U } from '../services/m3u-parser';
import { useToastStore } from './toast';
import { GroupObject } from '@/m3u/group';
import { LucideCircleCheckBig, LucideFlame, LucideHeart, LucidePodcast, LucideTheater, LucideTv } from 'lucide-react';
import { WatchableObject } from '@/m3u/watchable';
import { M3UObject } from '@/m3u/m3u';
import { FileSyncedState, syncFile } from '@/tools/fileSync';
import { UserData } from '@/types/userdata';
import { fileSystem } from '@/libs';

export type CategoryType = 'all' | 'movies' | 'series' | 'live' | 'favorites' | 'recent';
export type SortBy = 'name' | 'date' | 'recent';
export type SortOrder = 'asc' | 'desc';

const getUserDataPath = (username: string) => `userData/${username}.json`;
const getM3USource = (uuid: string) => `m3u/${uuid}/source.m3u`;
const getM3UUpdate = (uuid: string) => `m3u/${uuid}/update.json`;
const getM3UStats = (uuid: string) => `m3u/${uuid}/stats.json`;

interface M3UUpdateData {
  items: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export interface SeriesGroup {
  seriesName: string;
  episodes: WatchableObject[];
  totalEpisodes: number;
}


type ContentState =
  FileSyncedState<UserData, 'userData'> &
  {
    items: WatchableObject[];
    recentItems: WatchableObject[];
    favoritesItems: WatchableObject[];
    currentCategory: GroupObject;
    searchQuery: string;
    sortBy: SortBy;
    sortOrder: SortOrder;
    isLoading: boolean;
    currentUsername: string | null;
    currentUUID: string | null;

    movieGroup: GroupObject,
    tvShowGroup: GroupObject,
    streamGroup: GroupObject,
    recentGroup: GroupObject,
    favoriteGroup: GroupObject,
    watchedGroup: GroupObject,

    // Actions
    reset: () => void;
    setContent: (username: string, uuid: string) => Promise<void>;
    load: (fromUpdate?: boolean) => Promise<void>;
    update: () => Promise<void>;
    setCategory: (category: GroupObject) => void;
    setSearchQuery: (query: string) => void;
    setSortBy: (sortBy: SortBy) => void;
    setSortOrder: (order: SortOrder) => void;
    getFilteredItems: () => WatchableObject[];
    toggleFavorite: (url: string) => Promise<void>;
    saveWatchProgress: (url: string, position: number, duration: number) => Promise<void>;
    clearItems: () => void;

    // Series helpers
    getSeriesGroups: () => SeriesGroup[];
    getEpisodesForSeries: (seriesName: string) => WatchableObject[];
    getNextEpisode: (currentItem: WatchableObject) => WatchableObject | null;
    getPreviousEpisode: (currentItem: WatchableObject) => WatchableObject | null;
  }

export const useContentStore = create<ContentState>((set, get) => ({
  // File-synced profiles
  ...syncFile<UserData, 'userData'>(null, [], 'userData')(set, get),

  items: [],
  recentItems: [],
  favoritesItems: [],
  currentCategory: null!,
  searchQuery: '',
  sortBy: 'name',
  sortOrder: 'asc',
  isLoading: false,
  currentUsername: null,
  currentUUID: null,

  movieGroup: null!,
  tvShowGroup: null!,
  streamGroup: null!,
  recentGroup: null!,
  favoriteGroup: null!,
  watchedGroup: null!,

  reset: () => {
    const favoriteGroup = new GroupObject("Favorites", LucideHeart);
    get().setUserDataFile(null)
    set({
      items: [],
      recentItems: [],
      favoritesItems: [],
      currentCategory: favoriteGroup,
      searchQuery: '',
      sortBy: 'name',
      sortOrder: 'asc',
      isLoading: false,
      currentUsername: null,
      currentUUID: null,
      movieGroup: new GroupObject("Movies", LucideTheater),
      tvShowGroup: new GroupObject("TV Shows", LucideTv),
      streamGroup: new GroupObject("Live Streams", LucidePodcast),
      recentGroup: new GroupObject("Recent", LucideFlame),
      favoriteGroup,
      watchedGroup: new GroupObject("Watched", LucideCircleCheckBig),
    });
  },

  setContent: async (username, uuid) => {
    get().reset();
    set({
      currentUsername: username,
      currentUUID: uuid,
    });
    await get().setUserDataFile(getUserDataPath(username));
  },

  load: async (fromUpdate = false) => {
    /*
      Bu fonksiyonun yapması gerekenler:
        - öncelikle bu fonksiyon kullanıcı seçildi ise çalışabilir (username ve uuid setContent!)
        - bu fonksiyon fetch etmez. kullanıcının bir önceki girişiminden yaptığı kaynakları yükler ayarlar ile birleştirir.
        - yani UUID ile source ve update kısmını yükler.
        - user'in favori hide etc ayarlarını yükler.
        - sonra parseM3U ile source kısmını parse eder.
        - her bir m3u objesi eklenirken kontrol eder
          * eğer update listesinde varsa ekstradan Recent klasörüne de ekler
          * eğer favorilerde varsa ekstradan Favorites klasörüne de ekler (ve Watchable objesine isFavorite true verir)
          * eğer watchlistde varsa ekstradan Watched klasörüne de ekler (ve Watchable objesine isWatched true verir)
          * diğer tüm user ayarlarını aynı şekilde kontrol eder. yükler. 
    */
    const { currentUsername, currentUUID } = get();

    if (!currentUsername || !currentUUID) {
      console.error('Cannot load: username or UUID not set. Call setContent first.');

      // throw error so this bug can be fixed
      throw new Error('Cannot load content: profile not set');
    }

    set({ isLoading: true });

    try {
      console.log(`[Content Store] Loading content for ${currentUsername}/${currentUUID}`);
      const dateNow = Date.now();
      // Read UUID data using new API
      const source = await fileSystem.readFile(getM3USource(currentUUID));
      const update = await fileSystem.readJSONOrDefault<M3UUpdateData>(
        getM3UUpdate(currentUUID),
        {
          items: {},
          createdAt: dateNow,
          updatedAt: dateNow
        }
      );

      // Read user data from IPC and store in state
      const { userData } = get();

      if (!source) {
        if (!fromUpdate) { // dont show error on update
          console.error(`[Content Store] No source content found for ${currentUUID}`);
          useToastStore.getState().error('No source content found, use update instead');
        }
        return;
      }

      const m3uList = await parseM3U(source);

      for (const item of m3uList) {
        let watchable: WatchableObject = null!
        switch (item.category) {
          case 'Movie':
            watchable = get().movieGroup.addGroup(item.group).Add(item);
            break;
          case 'Series':
            watchable = get().tvShowGroup.addGroup(item.group).AddTvShow(item);
            break;
          case 'LiveStream':
            watchable = get().streamGroup.addGroup(item.group).Add(item);
            break;
        }

        const addedDate = update.items?.[item.url];
        if (addedDate) {
          watchable.AddedDate = new Date(addedDate);
          get().recentGroup.AddWatchable(watchable);
        }
        else {
          watchable.AddedDate = new Date(update.createdAt);
        }

        const userItemData = userData[item.url];
        if (userItemData) {
          watchable.userData = userItemData;
          if (userItemData.favorite) {
            get().favoriteGroup.AddWatchable(watchable);
          }
          if (userItemData.watched) {
            get().watchedGroup.AddWatchable(watchable);
          }
        }
      }

      // TODO: check this functions. they must sort items and calculate the stats!
      get().movieGroup.lastCheck();
      get().tvShowGroup.lastCheck();
      get().streamGroup.lastCheck();
      get().recentGroup.lastCheck();

      if (update.createdAt === dateNow) {
        // Create new update file in case it doesn't exist
        await fileSystem.writeJSON(getM3UUpdate(currentUUID), update);
      }
    } catch (error) {
      console.error('[Content Store] Failed to load content:', error);
      useToastStore.getState().error('Failed to load content');
    } finally {
      set({ isLoading: false });
    }
  },

  update: async () => {
    const { currentUsername, currentUUID } = get();

    get().load(true);

    if (!currentUsername || !currentUUID) {
      console.error('Cannot update: username or UUID not set. Call setContent first.');

      // throw error so this bug can be fixed
      throw new Error('Cannot update content: profile not set');
    }

    set({ isLoading: true });

    try {
      console.log(`[Content Store] Updating content for ${currentUsername}/${currentUUID}`);

      // Get URL for this UUID
      const url = await window.electron.m3u.getURLForUUID(currentUUID);
      const { update } = await window.electron.m3u.readUUID(currentUUID);

      if (!url) {
        throw new Error('No URL found for this UUID');
      }

      console.log(`[Content Store] Fetching from: ${url}`);

      // Fetch fresh content from URL or file
      const source = await window.electron.m3u.fetchUUID(url);

      console.log(`[Content Store] Fetched ${source.length} bytes`);

      const dateNow = Date.now();
      const lastUpdate = {
        createdAt: dateNow,
        items: {},
        ...update, // overwrite with existing data
        lastUpdated: dateNow, // overwrite with current time
      };

      const m3uList = await parseM3U(source);

      const AddIf = (group: GroupObject, item: M3UObject) => {
        if (group.has(item)) // TODO: create an has function that returns boolean if item exists regarding it is a tv show (different logic)
          return;
        const watchable = group.addGroup(item.group).Add(item);
        watchable.AddedDate = new Date(dateNow);
        lastUpdate.items[item.url] = dateNow;
        get().recentGroup.AddWatchable(watchable);
      }

      for (const item of m3uList) {
        switch (item.category) {
          case 'Movie':
            AddIf(get().movieGroup, item);
            break;
          case 'Series':
            AddIf(get().tvShowGroup, item);
            break;
          case 'LiveStream':
            AddIf(get().streamGroup, item);
            break;
        }
      }

      // TODO: check this functions. they must sort items and calculate the stats!
      get().movieGroup.lastCheck();
      get().tvShowGroup.lastCheck();
      get().streamGroup.lastCheck();
      get().recentGroup.lastCheck();

      // Write to storage using new API
      await window.electron.m3u.writeUUID(currentUUID, {
        source,
        update: lastUpdate,
      });

      console.log(`[Content Store] Content updated successfully`);
      useToastStore.getState().success('Content updated successfully');
    } catch (error) {
      console.error('[Content Store] Failed to update content:', error);
      useToastStore.getState().error(`Failed to update content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      set({ isLoading: false });
    }
  },

  setCategory: (category) => set({ currentCategory: category }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSortBy: (sortBy) => set({ sortBy }),

  setSortOrder: (order) => set({ sortOrder: order }),

  getFilteredItems: () => {
    const { currentCategory, searchQuery, sortBy, sortOrder } = get();

    // Step 1: Filter by category
    let filtered: WatchableObject[] = currentCategory?.Watchables?.length ? [...currentCategory.Watchables] : [];

    // Step 2: Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) =>
        item.Title.toLowerCase().includes(query)
      );
    }

    // Step 3: Sort items
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.Title.localeCompare(b.Title);
          break;
        case 'date':
          comparison = new Date(a.AddedDate).getTime() - new Date(b.AddedDate).getTime();
          break;
        case 'recent':
          if (a.userData?.lastWatchedAt && b.userData?.lastWatchedAt) {
            comparison = new Date(b.userData?.lastWatchedAt).getTime() - new Date(a.userData?.lastWatchedAt).getTime();
          } else if (a.userData?.lastWatchedAt) {
            comparison = -1;
          } else if (b.userData?.lastWatchedAt) {
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
      userData: {},
      searchQuery: '',
      sortBy: 'name',
      sortOrder: 'asc',
    });
  },

  readUserData: async () => {
    const { currentUsername, currentUUID } = get();
    if (!currentUsername || !currentUUID) {
      console.error('Cannot read user data: username or UUID not set');
      return;
    }

    const userDataPath = `userData/${currentUsername}.json`;

    try {
      const userData = await window.electron.userData.readData(currentUsername, currentUUID);
      set({ userData: userData || {} });
      console.log(`[Content Store] Read user data for ${currentUsername}/${currentUUID}`);
    } catch (error) {
      console.error('[Content Store] Failed to read user data:', error);
      set({ userData: {} });
    }
  },

  updateUserData: async (data: Record<string, UserItemData>) => {
    const { currentUsername, currentUUID } = get();
    if (!currentUsername || !currentUUID) {
      console.error('Cannot update user data: username or UUID not set');
      return;
    }

    try {
      await window.electron.userData.writeData(currentUsername, currentUUID, data);
      set({ userData: data });
      console.log(`[Content Store] Updated user data for ${currentUsername}/${currentUUID}`);
    } catch (error) {
      console.error('[Content Store] Failed to update user data:', error);
      throw error;
    }
  },

  deleteUserData: async () => {
    const { currentUsername, currentUUID } = get();
    if (!currentUsername || !currentUUID) {
      console.error('Cannot delete user data: username or UUID not set');
      return;
    }

    try {
      await window.electron.userData.deleteData(currentUsername, currentUUID);
      set({ userData: {} });
      console.log(`[Content Store] Deleted user data for ${currentUsername}/${currentUUID}`);
    } catch (error) {
      console.error('[Content Store] Failed to delete user data:', error);
      throw error;
    }
  },

  getSeriesGroups: () => {
    const { items } = get();
    const seriesItems = items.filter((item) => item.category.type === 'series');

    // Group by series name
    const groups = new Map<string, WatchableObject[]>();
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
