import { create } from 'zustand';
import { parseM3U } from '../services/m3u-parser';
import { useToastStore } from './toast';
import { GroupObject, TvShowGroupObject, TvShowSeasonGroupObject, UserItemData } from '@zenith-tv/content';
import { LucideCircleCheckBig, LucideFlame, LucideHeart, LucidePodcast, LucideTheater, LucideTv } from 'lucide-react';
import { TvShowWatchableObject, WatchableObject } from '@zenith-tv/content';
import { M3UObject } from '@zenith-tv/content';
import { FileSyncedState, syncFile } from '@/tools/fileSync';
import { fileSystem, http } from '@/libs';
import { useProfilesStore } from './profiles';
import { useSettingsStore } from './settings';

export type CategoryType = 'all' | 'movies' | 'series' | 'live' | 'favorites' | 'recent';
export type SortBy = 'name' | 'date' | 'recent';
export type SortOrder = 'asc' | 'desc';
export type GroupBy = 'none' | 'group' | 'year' | 'alphabetic';

export interface LayoutData {
  categoryBrowser: number;
  contentBrowser: number;
}

export interface PlayerData {
  sortBy: SortBy;
  sortOrder: SortOrder;
  groupBy: GroupBy;
}

export interface UserData {
  watchables: Record<string, UserItemData>;
  hiddenGroups: string[];
  stickyGroups: string[];
  playerData: PlayerData;
  layoutData: LayoutData;
}

// Helper function to convert seconds to progress (0-1)
const secondsToProgress = (position: number, duration: number): number => {
  if (duration <= 0) return 0;
  return position / duration;
};

// Turkish alphabet letters for alphabetic grouping
const ALPHABETIC_GROUPS = [
  'A', 'B', 'C', 'Ç', 'D', 'E', 'F', 'G', 'Ğ', 'H', 'I', 'İ', 'J', 'K', 'L',
  'M', 'N', 'O', 'Ö', 'P', 'R', 'S', 'Ş', 'T', 'U', 'Ü', 'V', 'Y', 'Z', '#'
];

export interface ContentGroupData {
  title: string;
  items: WatchableObject[] | GroupObject[];
  type: 'groups' | 'watchables';
}

const getUserDataPath = (username: string) => `userData/${username}.json`;
const getM3USource = (uuid: string) => `m3u/${uuid}/source.m3u`;
const getM3UUpdate = (uuid: string) => `m3u/${uuid}/update.json`;
const getM3UStats = (uuid: string) => `m3u/${uuid}/stats.json`;

interface M3UUpdateData {
  items: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export interface M3UStats {
  groupCount: number;
  tvShowCount: number;
  liveStreamCount: number;
  movieCount: number;
  totalWatchables: number;
}


type ContentState =
  FileSyncedState<UserData, 'userData'> &
  {
    items: WatchableObject[];
    recentItems: WatchableObject[];
    favoritesItems: WatchableObject[];
    currentGroup: GroupObject | null;
    searchQuery: string;
    sortBy: SortBy;
    sortOrder: SortOrder;
    groupBy: GroupBy;
    groupedContent: ContentGroupData[];
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
    setGroup: (group: GroupObject | null) => void;
    setSearchQuery: (query: string) => void;
    setSortBy: (sortBy: SortBy) => void;
    setSortOrder: (order: SortOrder) => void;
    setGroupBy: (groupBy: GroupBy) => void;
    updateGroupedContent: () => void;

    // User data actions
    toggleFavorite: (watchable: WatchableObject) => void;
    toggleHidden: (watchable: WatchableObject) => void;
    saveWatchProgress: (watchable: WatchableObject, position: number, duration: number) => void;
    saveTrackSelection: (watchable: WatchableObject, audioTrack?: number, subtitleTrack?: number) => void;

    getNextEpisode: (currentItem: WatchableObject) => WatchableObject | undefined;
    getPreviousEpisode: (currentItem: WatchableObject) => WatchableObject | undefined;
    calculateStats: () => M3UStats;
  }

export const useContentStore = create<ContentState>((set, get) => ({
  // File-synced profiles
  ...syncFile<UserData, 'userData'>(null, {
    watchables: {},
    playerData: {
      groupBy: 'none',
      sortBy: 'name',
      sortOrder: 'asc'
    },
    layoutData: {
      categoryBrowser: 200,
      contentBrowser: 600
    },
    hiddenGroups: [],
    stickyGroups: [],
  }, 'userData')(set, get),

  items: [],
  recentItems: [],
  favoritesItems: [],
  currentGroup: null,
  searchQuery: '',
  sortBy: 'name',
  sortOrder: 'asc',
  groupBy: 'none',
  groupedContent: [],
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
    const userData = get().userData
    const playerData = userData.playerData
    set({
      items: [],
      recentItems: [],
      favoritesItems: [],
      currentGroup: null,
      searchQuery: '',
      sortBy: playerData?.sortBy || 'name',
      sortOrder: playerData?.sortOrder || 'asc',
      groupBy: playerData?.groupBy || 'none',
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
    if (username === get().currentUsername && uuid === get().currentUUID) {
      return
    }

    get().reset();
    set({
      currentUsername: username,
      currentUUID: uuid,
    });
    useSettingsStore.getState().setLastProfile(username, uuid);
    await get().setUserDataFile(getUserDataPath(username));
    await get().load();
  },

  load: async (fromUpdate = false) => {
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

        const userItemData = userData?.watchables?.[item.url];
        if (userItemData) {
          watchable.userData = userItemData;

          // Add to favorite group if marked as favorite
          if (userItemData.favorite?.value) {
            get().favoriteGroup.AddWatchable(watchable);
          }

          // Add to watched group if marked as watched
          if (userItemData.watchProgress?.watched) {
            get().watchedGroup.AddWatchable(watchable);
          }
        }
      }

      get().movieGroup.lastCheck();
      get().tvShowGroup.lastCheck();
      get().streamGroup.lastCheck();
      get().recentGroup.lastCheck();

      const stats = get().calculateStats();
      if (stats.totalWatchables !== m3uList.length) {
        console.warn(`[Content Store] Stats mismatch! Expected ${m3uList.length}, got ${stats.totalWatchables}`);
      }
      await fileSystem.writeJSON(getM3UStats(currentUUID), stats);

      if (update.createdAt === dateNow) {
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
      const dateNow = Date.now();

      // Get URL for this UUID
      const url = useProfilesStore.getState().getUrlFromUUID(currentUUID);
      if (!url) {
        throw new Error('No URL found for this UUID');
      }

      const update = await fileSystem.readJSONOrDefault<M3UUpdateData>(
        getM3UUpdate(currentUUID),
        {
          items: {},
          createdAt: dateNow,
          updatedAt: dateNow
        }
      );

      console.log(`[Content Store] Fetching from: ${url}`);

      // Fetch fresh content from URL or file
      const source = await http.fetchM3U(url);
      console.log(`[Content Store] Fetched ${source.length} bytes`);

      const m3uList = await parseM3U(source);

      if (m3uList.length) {
        await fileSystem.writeFile(getM3USource(currentUUID), source);
      }

      const AddIf = (group: GroupObject, item: M3UObject) => {
        if (group.has(item))
          return;
        const watchable = group.addGroup(item.group).Add(item);
        watchable.AddedDate = new Date(dateNow);
        update.items[item.url] = dateNow;
        get().recentGroup.AddWatchable(watchable);
      }

      const { movieGroup, tvShowGroup, streamGroup } = get();

      for (const item of m3uList) {
        switch (item.category) {
          case 'Movie':
            AddIf(movieGroup, item);
            break;
          case 'Series':
            AddIf(tvShowGroup, item);
            break;
          case 'LiveStream':
            AddIf(streamGroup, item);
            break;
        }
      }

      get().movieGroup.lastCheck();
      get().tvShowGroup.lastCheck();
      get().streamGroup.lastCheck();
      get().recentGroup.lastCheck();

      const stats = get().calculateStats();
      if (stats.totalWatchables !== m3uList.length) {
        console.warn(`[Content Store] Stats mismatch! Expected ${m3uList.length}, got ${stats.totalWatchables}`);
      }

      await fileSystem.writeJSON(getM3UUpdate(currentUUID), update);
      await fileSystem.writeJSON(getM3UStats(currentUUID), stats);

      console.log(`[Content Store] Content updated successfully`);
      useToastStore.getState().success('Content updated successfully');
    } catch (error) {
      console.error('[Content Store] Failed to update content:', error);
      useToastStore.getState().error(`Failed to update content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      set({ isLoading: false });
    }
  },

  setGroup: (group) => {
    if (get().currentGroup === group) return;
    set({ currentGroup: group });
    get().updateGroupedContent();
  },

  setSearchQuery: (query) => {
    if (get().searchQuery === query) return;
    set({ searchQuery: query });
    get().updateGroupedContent();
  },

  setSortBy: (sortBy) => {
    if (get().sortBy === sortBy) return;
    set({ sortBy });
    get().updateGroupedContent();
  },

  setSortOrder: (order) => {
    if (get().sortOrder === order) return;
    set({ sortOrder: order });
    get().updateGroupedContent();
  },

  setGroupBy: (groupBy) => {
    if (get().groupBy === groupBy) return;
    set({ groupBy });
    get().updateGroupedContent();
  },

  updateGroupedContent: () => {
    const { currentGroup, groupBy, searchQuery, sortBy, sortOrder, setUserData } = get();

    setUserData(data => ({
      ...data,
      playerData: {
        groupBy,
        sortBy,
        sortOrder
      }
    }));

    if (!currentGroup) {
      set({ groupedContent: [] });
      return;
    }

    // Helper function to sort items
    const sortItems = <T extends WatchableObject | GroupObject>(items: T[]): T[] => {
      return [...items].sort((a, b) => {
        let comparison = 0;

        if (a instanceof WatchableObject && b instanceof WatchableObject) {
          switch (sortBy) {
            case 'name':
              comparison = a.Name.localeCompare(b.Name);
              break;
            case 'date':
              comparison = new Date(a.AddedDate!).getTime() - new Date(b.AddedDate!).getTime();
              break;
            case 'recent':
              {
                const aLastWatched = a.userData?.watchProgress?.updatedAt;
                const bLastWatched = b.userData?.watchProgress?.updatedAt;
                if (aLastWatched && bLastWatched) {
                  comparison = bLastWatched - aLastWatched;
                } else if (aLastWatched) {
                  comparison = -1;
                } else if (bLastWatched) {
                  comparison = 1;
                }
                break;
              }
          }
        } else {
          comparison = a.Name.localeCompare(b.Name);
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });
    };

    // Helper function to filter by search
    const filterBySearch = (items: WatchableObject[]): WatchableObject[] => {
      if (!searchQuery.trim()) return items;
      const query = searchQuery.toLowerCase();
      return items.filter(item => item.Name.toLowerCase().includes(query));
    };

    // Helper to get first letter for alphabetic grouping
    const getFirstLetter = (name: string): string => {
      const firstChar = name.charAt(0).toUpperCase();
      if (ALPHABETIC_GROUPS.includes(firstChar)) {
        return firstChar;
      }
      return '#';
    };

    // Helper to collect all groups recursively
    const collectGroupsRecursive = (group: GroupObject): GroupObject[] => {
      const collected: GroupObject[] = [...group.Groups];
      group.Groups.forEach(g => collected.push(...collectGroupsRecursive(g)));
      return collected;
    };

    // Helper to collect all watchables recursively
    const collectWatchablesRecursive = (group: GroupObject): WatchableObject[] => {
      const collected: WatchableObject[] = [...group.Watchables];
      group.Groups.forEach(g => collected.push(...collectWatchablesRecursive(g)));
      return collected;
    };

    // Check if we're searching
    const isSearching = searchQuery.trim().length > 0;

    // Get groups based on search:
    // - No search: only direct subgroups
    // - With search: recursive + filter by name
    const getGroups = (): GroupObject[] => {
      if (isSearching) {
        const allGroups = collectGroupsRecursive(currentGroup);
        const query = searchQuery.toLowerCase();
        return allGroups.filter(g => g.Name.toLowerCase().includes(query));
      }
      return [...currentGroup.Groups];
    };

    // Get watchables based on search:
    // - No search: only direct watchables
    // - With search: recursive + filter by name
    const getWatchables = (): WatchableObject[] => {
      if (isSearching) {
        return filterBySearch(collectWatchablesRecursive(currentGroup));
      }
      return [...currentGroup.Watchables];
    };

    const result: ContentGroupData[] = [];

    switch (groupBy) {
      case 'none': {
        // Groups and watchables in a single list style
        const groups = getGroups();
        if (groups.length > 0) {
          result.push({
            title: 'Groups',
            items: sortItems(groups),
            type: 'groups'
          });
        }

        const watchables = getWatchables();
        if (watchables.length > 0) {
          result.push({
            title: currentGroup.Name,
            items: sortItems(watchables),
            type: 'watchables'
          });
        }
        break;
      }

      case 'group': {
        // First ContentGroup: Groups
        const groups = getGroups();
        if (groups.length > 0) {
          result.push({
            title: 'Groups',
            items: sortItems(groups),
            type: 'groups'
          });
        }

        // Second ContentGroup: Watchables
        const watchables = getWatchables();
        if (watchables.length > 0) {
          result.push({
            title: 'Items',
            items: sortItems(watchables),
            type: 'watchables'
          });
        }
        break;
      }

      case 'year': {
        // Group by year
        const yearMap = new Map<string, WatchableObject[]>();
        const filteredWatchables = getWatchables();

        for (const item of filteredWatchables) {
          const yearKey = item.Year ? item.Year.toString() : 'Unknown Year';
          if (!yearMap.has(yearKey)) {
            yearMap.set(yearKey, []);
          }
          yearMap.get(yearKey)!.push(item);
        }

        // Sort years descending (newest first), Unknown Year at the end
        const sortedYears = Array.from(yearMap.keys()).sort((a, b) => {
          if (a === 'Unknown Year') return 1;
          if (b === 'Unknown Year') return -1;
          return parseInt(b) - parseInt(a);
        });

        for (const year of sortedYears) {
          const items = yearMap.get(year)!;
          if (items.length > 0) {
            result.push({
              title: year,
              items: sortItems(items),
              type: 'watchables'
            });
          }
        }
        break;
      }

      case 'alphabetic': {
        // Group by first letter
        const letterMap = new Map<string, WatchableObject[]>();
        const filteredWatchables = getWatchables();

        for (const item of filteredWatchables) {
          const letter = getFirstLetter(item.Name);
          if (!letterMap.has(letter)) {
            letterMap.set(letter, []);
          }
          letterMap.get(letter)!.push(item);
        }

        // Sort letters by Turkish alphabet order
        const sortedLetters = Array.from(letterMap.keys()).sort((a, b) => {
          const indexA = ALPHABETIC_GROUPS.indexOf(a);
          const indexB = ALPHABETIC_GROUPS.indexOf(b);
          return indexA - indexB;
        });

        for (const letter of sortedLetters) {
          const items = letterMap.get(letter)!;
          if (items.length > 0) {
            result.push({
              title: letter,
              items: sortItems(items),
              type: 'watchables'
            });
          }
        }
        break;
      }
    }

    set({ groupedContent: result });
  },

  toggleFavorite: (watchable) => {
    const { currentUsername, currentUUID, setUserData, favoriteGroup } = get();
    if (!currentUsername || !currentUUID) return;

    const currentFavorite = watchable.userData.favorite?.value ?? false;
    const newFavoriteValue = !currentFavorite;
    const now = Date.now();

    // Update watchable userData
    watchable.userData.favorite = {
      value: newFavoriteValue,
      updatedAt: now
    };

    // Update userData store
    setUserData(prev => ({
      ...prev,
      watchables: {
        ...prev.watchables,
        [watchable.Url]: watchable.userData
      }
    }));

    // Update favorite group
    if (newFavoriteValue) {
      favoriteGroup.AddWatchable(watchable);
      useToastStore.getState().success('Added to favorites');
    } else {
      favoriteGroup.RemoveWatchable(watchable);
      useToastStore.getState().info('Removed from favorites');
    }
  },

  saveWatchProgress: (watchable, position, duration) => {
    const { currentUsername, currentUUID, setUserData, watchedGroup } = get();
    if (!currentUsername || !currentUUID) return;
    if (watchable.category === 'LiveStream') return;

    const progress = secondsToProgress(position, duration);
    const now = Date.now();
    const isWatched = progress > 0.95;

    // Check if already marked as watched
    const previousWatchedTimestamp = watchable.userData.watchProgress?.watched;
    const wasAlreadyWatched = previousWatchedTimestamp !== null && previousWatchedTimestamp !== undefined;

    // If already watched and trying to save progress=0, skip (already saved)
    const previousProgress = watchable.userData.watchProgress?.progress ?? 0;
    if (wasAlreadyWatched && progress === 0 && previousProgress === 0) {
      return; // Already reset to 0, no need to save again
    }

    // If >95%, reset progress to 0 so next time starts from beginning
    const progressToSave = isWatched ? 0 : progress;

    // Update watchable userData
    watchable.userData.watchProgress = {
      progress: progressToSave,
      updatedAt: now,
      // Keep existing watched timestamp if already set, otherwise set new one if just finished
      watched: wasAlreadyWatched ? previousWatchedTimestamp : (isWatched ? now : null)
    };

    // Update userData store
    setUserData(prev => ({
      ...prev,
      watchables: {
        ...prev.watchables,
        [watchable.Url]: watchable.userData
      }
    }));

    // Add to watched group only if just finished watching (not already watched)
    if (isWatched && !wasAlreadyWatched) {
      watchedGroup.AddWatchable(watchable);
    }
  },

  toggleHidden: (watchable) => {
    const { currentUsername, currentUUID, setUserData } = get();
    if (!currentUsername || !currentUUID) return;

    const currentHidden = watchable.userData.hidden?.value ?? false;
    const newHiddenValue = !currentHidden;
    const now = Date.now();

    // Update watchable userData
    watchable.userData.hidden = {
      value: newHiddenValue,
      updatedAt: now
    };

    // Update userData store
    setUserData(prev => ({
      ...prev,
      watchables: {
        ...prev.watchables,
        [watchable.Url]: watchable.userData
      }
    }));

    // Show toast notification
    if (newHiddenValue) {
      useToastStore.getState().info('Item hidden');
    } else {
      useToastStore.getState().info('Item unhidden');
    }
  },

  saveTrackSelection: (watchable, audioTrack, subtitleTrack) => {
    const { currentUsername, currentUUID, setUserData } = get();
    if (!currentUsername || !currentUUID) return;

    const now = Date.now();

    // Update watchable userData
    watchable.userData.tracks = {
      audio: audioTrack,
      subtitle: subtitleTrack,
      updatedAt: now
    };

    // Update userData store
    setUserData(prev => ({
      ...prev,
      watchables: {
        ...prev.watchables,
        [watchable.Url]: watchable.userData
      }
    }));
  },

  getNextEpisode: (currentItem) => {
    if (currentItem.category !== 'Series') return undefined;
    const tvShow = currentItem as TvShowWatchableObject;
    const seasonGroup = tvShow.UpperLevel as TvShowSeasonGroupObject;


    const watchable = seasonGroup.getEpisode(tvShow.Episode + 1);
    if (watchable) {
      return watchable;
    }

    const tvShowGroup = seasonGroup.UpperLevel as TvShowGroupObject;

    return tvShowGroup.getEpisode(seasonGroup.Season + 1, 1);
  },

  getPreviousEpisode: (currentItem) => {
    if (currentItem.category !== 'Series') return undefined;

    const tvShow = currentItem as TvShowWatchableObject;
    const seasonGroup = tvShow.UpperLevel as TvShowSeasonGroupObject;

    const prevEpisode = tvShow.Episode - 1
    if (prevEpisode > 0) {
      return seasonGroup.getEpisode(prevEpisode);
    }

    const prevSeason = seasonGroup.Season - 1;
    if (prevSeason > 0) {
      const tvShowGroup = seasonGroup.UpperLevel as TvShowGroupObject;
      const prevSeasonGroup = tvShowGroup.getSeason(prevSeason);

      if (prevSeasonGroup) {
        return prevSeasonGroup.getEpisode(prevSeasonGroup.episodeCount);
      }
    }

    return undefined;
  },

  calculateStats: () => {
    const { movieGroup, tvShowGroup, streamGroup } = get();

    const countGroups = (group: GroupObject): number => {
      return group.Groups.length + group.Groups.reduce((total, g) => total + countGroups(g), 0);
    };

    const movieCount = movieGroup.TotalCount;
    const tvShowCount = tvShowGroup.TvShowCount;
    const tvShowEpisodeCount = tvShowGroup.TvShowEpisodeCount;
    const liveStreamCount = streamGroup.TotalCount;


    const groupCount = countGroups(movieGroup) + countGroups(tvShowGroup) + countGroups(streamGroup);
    const totalWatchables = movieCount + tvShowEpisodeCount + liveStreamCount;

    return {
      groupCount,
      tvShowCount,
      liveStreamCount,
      movieCount,
      totalWatchables,
    };
  },
}));
