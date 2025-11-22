import { create } from 'zustand';
import { parseM3U } from '../services/m3u-parser';
import { useToastStore } from './toast';
import { GroupObject, TvShowGroupObject, TvShowSeasonGroupObject } from '@/m3u/group';
import { LucideCircleCheckBig, LucideFlame, LucideHeart, LucidePodcast, LucideTheater, LucideTv } from 'lucide-react';
import { TvShowWatchableObject, WatchableObject } from '@/m3u/watchable';
import { M3UObject } from '@/m3u/m3u';
import { FileSyncedState, syncFile } from '@/tools/fileSync';
import { UserData } from '@/types/userdata';
import { fileSystem, http } from '@/libs';
import { useProfilesStore } from './profiles';

export type CategoryType = 'all' | 'movies' | 'series' | 'live' | 'favorites' | 'recent';
export type SortBy = 'name' | 'date' | 'recent';
export type SortOrder = 'asc' | 'desc';
export type GroupBy = 'none' | 'group' | 'year' | 'alphabetic';

// Helper function to convert seconds to progress percentage
const secondsToProgress = (position: number, duration: number): number => {
  if (duration <= 0) return 0;
  return Math.round((position / duration) * 100);
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
    getFilteredItems: () => WatchableObject[];
    toggleFavorite: (watchable: WatchableObject) => Promise<void>;
    saveWatchProgress: (watchable: WatchableObject, position: number, duration: number) => Promise<void>;

    getNextEpisode: (currentItem: WatchableObject) => WatchableObject | undefined;
    getPreviousEpisode: (currentItem: WatchableObject) => WatchableObject | undefined;
  }

export const useContentStore = create<ContentState>((set, get) => ({
  // File-synced profiles
  ...syncFile<UserData, 'userData'>(null, {}, 'userData')(set, get),

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
    set({
      items: [],
      recentItems: [],
      favoritesItems: [],
      currentGroup: null,
      searchQuery: '',
      sortBy: 'name',
      sortOrder: 'asc',
      groupBy: 'none',
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
    await get().setUserDataFile(getUserDataPath(username));
    await get().load();
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

      // TODO: check this functions. they must sort items and calculate the stats!
      get().movieGroup.lastCheck();
      get().tvShowGroup.lastCheck();
      get().streamGroup.lastCheck();
      get().recentGroup.lastCheck();

      // Write to storage using new API
      await fileSystem.writeJSON(getM3UUpdate(currentUUID), update);

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
    const { currentGroup, groupBy, searchQuery, sortBy, sortOrder } = get();

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
              comparison = new Date(a.AddedDate).getTime() - new Date(b.AddedDate).getTime();
              break;
            case 'recent':
              if (a.userData?.lastWatchedAt && b.userData?.lastWatchedAt) {
                comparison = new Date(b.userData.lastWatchedAt).getTime() - new Date(a.userData.lastWatchedAt).getTime();
              } else if (a.userData?.lastWatchedAt) {
                comparison = -1;
              } else if (b.userData?.lastWatchedAt) {
                comparison = 1;
              }
              break;
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

  getFilteredItems: () => {
    const { currentGroup, searchQuery, sortBy, sortOrder } = get();

    // Step 1: Filter by group
    let filtered: WatchableObject[] = currentGroup?.Watchables?.length ? [...currentGroup.Watchables] : [];

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

  toggleFavorite: async (watchable) => {
    const { currentUsername, currentUUID } = get();
    if (!currentUsername || !currentUUID) return;


    try {
      const { setUserData } = get();
      const favorite = !watchable.userData.favorite

      watchable.userData.favorite = favorite;

      setUserData(p => ({
        ...p,
        [watchable.Url]: watchable.userData
      }))

      // Show toast notification
      if (favorite) {
        useToastStore.getState().success('Added to favorites');
      } else {
        useToastStore.getState().info('Removed from favorites');
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      useToastStore.getState().error('Failed to update favorite');
    }
  },

  saveWatchProgress: async (watchable, position, duration) => {
    const { currentUsername, currentUUID } = get();
    if (!currentUsername || !currentUUID) return;
    if (watchable.category === 'LiveStream') return;

    try {
      // Convert seconds to progress percentage
      const progress = secondsToProgress(position, duration);

      watchable.userData.watchProgress = progress;
      if (progress > 95) {
        watchable.userData.watched = true;
        watchable.userData.watchedAt = Date.now();
      }

      get().setUserData(p => ({
        ...p,
        [watchable.Url]: watchable.userData
      }))

    } catch (error) {
      console.error('Failed to save watch progress:', error);
    }
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
}));
