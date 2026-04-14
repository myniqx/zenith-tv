import { create } from 'zustand'
import { syncFile } from '../tools/fileSync'
import { GroupObject, TvShowGroupObject, TvShowSeasonGroupObject, TvShowWatchableObject, WatchableObject } from '../../models'
import {
  LucideCircleCheckBig,
  LucideFlame,
  LucideHeart,
  LucidePodcast,
  LucideTheater,
  LucideTv
} from 'lucide-react'
import type {
  ContentState,
  ContentStoreDependencies,
  UserData,
  M3UUpdateData,
  ContentGroupData,
  StatusMessage,
} from './types'
import { IDLE_STATUS } from './types'

import {
  ALPHABETIC_GROUPS,
  secondsToProgress,
  sortItems,
  filterBySearch,
  getFirstLetter,
  collectGroupsRecursive,
  collectWatchablesRecursive,
  getUserDataPath,
  getM3USource,
  getM3UUpdate,
  getM3UStats
} from './helpers'
import { ProfileSyncPayload } from '../../types/p2p'

export * from './types'
export * from './helpers'

/**
 * Creates a content store with platform-specific dependencies
 */
export const createContentStore = (deps: ContentStoreDependencies) => {
  const { fileSystem, http, parseM3U, toast, getUrlFromUUID, setLastProfile } = deps

  return create<ContentState>((set, get) => ({
    ...syncFile<UserData, 'userData'>(fileSystem, null, {
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
    statusMessage: IDLE_STATUS,
    currentUsername: null,
    currentUUID: null,
    currentM3UUrl: null,

    movieGroup: null!,
    tvShowGroup: null!,
    streamGroup: null!,
    recentGroup: null!,
    favoriteGroup: null!,
    watchedGroup: null!,


    getWellComePayload(): ProfileSyncPayload | null {
      const { currentUsername, currentUUID, currentM3UUrl } = get()
      if (!currentM3UUrl) return null
      return {
        profile: {
          username: currentUsername!,
          uuid: currentUUID!,
          url: currentM3UUrl
        },
        userData: get().userData
      }
    },

    reset: () => {
      const favoriteGroup = new GroupObject("Favorites", LucideHeart)
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
        statusMessage: IDLE_STATUS,
        currentUsername: null,
        currentUUID: null,
        currentM3UUrl: null,
        movieGroup: new GroupObject("Movies", LucideTheater),
        tvShowGroup: new GroupObject("TV Shows", LucideTv),
        streamGroup: new GroupObject("Live Streams", LucidePodcast),
        recentGroup: new GroupObject("Recent", LucideFlame),
        favoriteGroup,
        watchedGroup: new GroupObject("Watched", LucideCircleCheckBig),
      })
    },

    setContent: async (username, uuid) => {
      if (username === get().currentUsername && uuid === get().currentUUID) {
        return
      }

      get().reset()
      set({
        currentUsername: username,
        currentUUID: uuid,
        currentM3UUrl: getUrlFromUUID(uuid),
      })
      setLastProfile(username, uuid)
      await get().setUserDataFile(getUserDataPath(username))
      await get().load()
    },

    load: async (fromUpdate = false) => {
      const { currentUsername, currentUUID } = get()

      if (!currentUsername || !currentUUID) {
        console.error('Cannot load: username or UUID not set. Call setContent first.')
        throw new Error('Cannot load content: profile not set')
      }

      const status = (msg: StatusMessage) => set({ statusMessage: msg })
      const startedAt = Date.now()

      set({ isLoading: true, statusMessage: { status: 'loading', message: 'Loading M3U...', percent: 0 } })

      try {
        const dateNow = Date.now()

        status({ status: 'loading', message: 'Reading file...', percent: 20 })
        const sourceExists = await fileSystem.exists(getM3USource(currentUUID))
        const source = sourceExists ? await fileSystem.readFile(getM3USource(currentUUID)) : null

        const update = await fileSystem.readJSONOrDefault<M3UUpdateData>(
          getM3UUpdate(currentUUID),
          { items: {}, createdAt: dateNow, updatedAt: dateNow }
        )

        const thirtyDaysAgo = dateNow - 30 * 24 * 60 * 60 * 1000
        let removedCount = 0
        for (const url of Object.keys(update.items)) {
          if (update.items[url] < thirtyDaysAgo) {
            delete update.items[url]
            removedCount++
          }
        }

        if (!source) {
          if (!fromUpdate) {
            const msg = 'M3U not synced yet. Use the sync button to download.'
            status({ status: 'error', message: msg, percent: null })
            toast.error(msg)
          }
          return
        }

        status({ status: 'loading', message: 'Parsing M3U...', percent: 40 })
        const parseStart = Date.now()
        const m3uList = await parseM3U(source)
        const parseMs = Date.now() - parseStart
        status({ status: 'loading', message: `Parsed in ${parseMs}ms — building content...`, percent: 55 })

        const { userData } = get()
        const BATCH = 10000
        for (let i = 0; i < m3uList.length; i++) {
          const item = m3uList[i]
          let watchable: WatchableObject = null!
          switch (item.category) {
            case 'Movie':
              watchable = get().movieGroup.addGroup(item.group).Add(item)
              break
            case 'Series':
              watchable = get().tvShowGroup.addGroup(item.group).AddTvShow(item)
              break
            case 'LiveStream':
              watchable = get().streamGroup.addGroup(item.group).Add(item)
              break
          }

          const addedDate = update.items?.[item.url]
          if (addedDate) {
            watchable.AddedDate = new Date(addedDate)
            get().recentGroup.AddWatchable(watchable)
          } else {
            watchable.AddedDate = new Date(update.createdAt)
          }

          const userItemData = userData?.watchables?.[item.url]
          if (userItemData) {
            watchable.userData = userItemData
            if (userItemData.favorite?.value) get().favoriteGroup.AddWatchable(watchable)
            if (userItemData.watchProgress?.watched) get().watchedGroup.AddWatchable(watchable)
          }

          if ((i + 1) % BATCH === 0) {
            const buildPercent = Math.round(55 + ((i + 1) / m3uList.length) * 40)
            status({ status: 'loading', message: `Building content... (${i + 1}/${m3uList.length})`, percent: buildPercent })
          }
        }

        get().movieGroup.lastCheck()
        get().tvShowGroup.lastCheck()
        get().streamGroup.lastCheck()
        get().recentGroup.lastCheck()

        const stats = get().calculateStats()
        if (stats.totalWatchables !== m3uList.length) {
          console.warn(`[Content Store] Stats mismatch! Expected ${m3uList.length}, got ${stats.totalWatchables}`)
        }
        await fileSystem.writeJSON(getM3UStats(currentUUID), stats)

        if (update.createdAt === dateNow || removedCount > 0) {
          await fileSystem.writeJSON(getM3UUpdate(currentUUID), update)
        }

        const totalMs = Date.now() - startedAt
        status({ status: 'ready', message: `Loaded in ${totalMs}ms`, percent: 100 })
      } catch (error) {
        console.error('[Content Store] Failed to load content:', error)
        const msg = (error instanceof Error ? error.message : null) || 'Failed to load content.'
        status({ status: 'error', message: msg, percent: null })
        toast.error(msg)
      } finally {
        set({ isLoading: false })
      }
    },

    update: async () => {
      const { currentUsername, currentUUID } = get()

      if (!currentUsername || !currentUUID) {
        console.error('Cannot update: username or UUID not set. Call setContent first.')
        throw new Error('Cannot update content: profile not set')
      }

      const status = (msg: StatusMessage) => set({ statusMessage: msg })
      const startedAt = Date.now()

      set({ isLoading: true, statusMessage: { status: 'loading', message: 'Starting update...', percent: 0 } })

      try {
        const dateNow = Date.now()

        const url = getUrlFromUUID(currentUUID)
        if (!url) throw new Error('No URL found for this UUID')

        const update = await fileSystem.readJSONOrDefault<M3UUpdateData>(
          getM3UUpdate(currentUUID),
          { items: {}, createdAt: dateNow, updatedAt: dateNow }
        )

        // Fake ramp up to %35 while fetching (callback cannot be passed over IPC)
        let fetchTimer: ReturnType<typeof setInterval> | null = null
        let fakePercent = 0

        fetchTimer = setInterval(() => {
          fakePercent = Math.min(fakePercent + 2, 34)
          status({ status: 'loading', message: 'Fetching M3U...', percent: fakePercent })
        }, 300)

        const source = await http.fetchM3U(url).catch((e) => {
          if (fetchTimer) { clearInterval(fetchTimer); fetchTimer = null }
          throw e
        })
        if (fetchTimer) { clearInterval(fetchTimer); fetchTimer = null }

        status({ status: 'loading', message: `Fetched ${(source.length / 1024).toFixed(0)} KB — parsing...`, percent: 40 })

        const parseStart = Date.now()
        const m3uList = await parseM3U(source)
        const parseMs = Date.now() - parseStart
        status({ status: 'loading', message: `Parsed in ${parseMs}ms — building content...`, percent: 55 })

        if (m3uList.length) {
          await fileSystem.writeFile(getM3USource(currentUUID), source)
        }

        const isFirstFetch = Object.keys(update.items).length === 0
        const { movieGroup, tvShowGroup, streamGroup } = get()
        const BATCH = 10000

        for (let i = 0; i < m3uList.length; i++) {
          const item = m3uList[i]
          const addItem = (group: GroupObject) => {
            if (group.has(item)) return
            const watchable = group.addGroup(item.group).Add(item)
            watchable.AddedDate = new Date(dateNow)
            update.items[item.url] = dateNow
            if (!isFirstFetch) get().recentGroup.AddWatchable(watchable)
          }
          switch (item.category) {
            case 'Movie': addItem(movieGroup); break
            case 'Series': addItem(tvShowGroup); break
            case 'LiveStream': addItem(streamGroup); break
          }

          if ((i + 1) % BATCH === 0) {
            const buildPercent = Math.round(55 + ((i + 1) / m3uList.length) * 40)
            status({ status: 'loading', message: `Building content... (${i + 1}/${m3uList.length})`, percent: buildPercent })
          }
        }

        get().movieGroup.lastCheck()
        get().tvShowGroup.lastCheck()
        get().streamGroup.lastCheck()
        get().recentGroup.lastCheck()

        const stats = get().calculateStats()
        if (stats.totalWatchables !== m3uList.length) {
          console.warn(`[Content Store] Stats mismatch! Expected ${m3uList.length}, got ${stats.totalWatchables}`)
        }

        await fileSystem.writeJSON(getM3UUpdate(currentUUID), update)
        await fileSystem.writeJSON(getM3UStats(currentUUID), stats)

        const totalMs = Date.now() - startedAt
        status({ status: 'ready', message: `Updated in ${totalMs}ms`, percent: 100 })
        toast.success('Content updated successfully')
      } catch (error) {
        console.error('[Content Store] Failed to update content:', error)
        const msg = (error instanceof Error ? error.message : null) || 'Failed to update content.'
        status({ status: 'error', message: msg, percent: null })
        toast.error(msg)
      } finally {
        set({ isLoading: false })
      }
    },

    setGroup: (group) => {
      if (get().currentGroup === group) return
      set({ currentGroup: group })
      get().updateGroupedContent()
    },

    setSearchQuery: (query) => {
      if (get().searchQuery === query) return
      set({ searchQuery: query })
      get().updateGroupedContent()
    },

    setSortBy: (sortBy) => {
      if (get().sortBy === sortBy) return
      set({ sortBy })
      get().updateGroupedContent()
    },

    setSortOrder: (order) => {
      if (get().sortOrder === order) return
      set({ sortOrder: order })
      get().updateGroupedContent()
    },

    setGroupBy: (groupBy) => {
      if (get().groupBy === groupBy) return
      set({ groupBy })
      get().updateGroupedContent()
    },

    updateGroupedContent: () => {
      const { currentGroup, groupBy, searchQuery, sortBy, sortOrder, setUserData } = get()

      setUserData(data => ({
        ...data,
        playerData: {
          groupBy,
          sortBy,
          sortOrder
        }
      }))

      if (!currentGroup) {
        set({ groupedContent: [] })
        return
      }

      const isSearching = searchQuery.trim().length > 0

      const getGroups = (): GroupObject[] => {
        if (isSearching) {
          const allGroups = collectGroupsRecursive(currentGroup)
          const query = searchQuery.toLowerCase()
          return allGroups.filter(g => g.Name.toLowerCase().includes(query))
        }
        return [...currentGroup.Groups]
      }

      const getWatchables = (): WatchableObject[] => {
        if (isSearching) {
          return filterBySearch(collectWatchablesRecursive(currentGroup), searchQuery)
        }
        return [...currentGroup.Watchables]
      }

      const result: ContentGroupData[] = []

      switch (groupBy) {
        case 'none': {
          const groups = getGroups()
          if (groups.length > 0) {
            result.push({
              title: 'Groups',
              items: sortItems(groups, sortBy, sortOrder),
              type: 'groups'
            })
          }

          const watchables = getWatchables()
          if (watchables.length > 0) {
            result.push({
              title: currentGroup.Name,
              items: sortItems(watchables, sortBy, sortOrder),
              type: 'watchables'
            })
          }
          break
        }

        case 'group': {
          const groups = getGroups()
          if (groups.length > 0) {
            result.push({
              title: 'Groups',
              items: sortItems(groups, sortBy, sortOrder),
              type: 'groups'
            })
          }

          const watchables = getWatchables()
          if (watchables.length > 0) {
            result.push({
              title: 'Items',
              items: sortItems(watchables, sortBy, sortOrder),
              type: 'watchables'
            })
          }
          break
        }

        case 'year': {
          const yearMap = new Map<string, WatchableObject[]>()
          const filteredWatchables = getWatchables()

          for (const item of filteredWatchables) {
            const yearKey = item.Year ? item.Year.toString() : 'Unknown Year'
            if (!yearMap.has(yearKey)) {
              yearMap.set(yearKey, [])
            }
            yearMap.get(yearKey)!.push(item)
          }

          const sortedYears = Array.from(yearMap.keys()).sort((a, b) => {
            if (a === 'Unknown Year') return 1
            if (b === 'Unknown Year') return -1
            return parseInt(b) - parseInt(a)
          })

          for (const year of sortedYears) {
            const items = yearMap.get(year)!
            if (items.length > 0) {
              result.push({
                title: year,
                items: sortItems(items, sortBy, sortOrder),
                type: 'watchables'
              })
            }
          }
          break
        }

        case 'alphabetic': {
          const letterMap = new Map<string, WatchableObject[]>()
          const filteredWatchables = getWatchables()

          for (const item of filteredWatchables) {
            const letter = getFirstLetter(item.Name)
            if (!letterMap.has(letter)) {
              letterMap.set(letter, [])
            }
            letterMap.get(letter)!.push(item)
          }

          const sortedLetters = Array.from(letterMap.keys()).sort((a, b) => {
            const indexA = ALPHABETIC_GROUPS.indexOf(a)
            const indexB = ALPHABETIC_GROUPS.indexOf(b)
            return indexA - indexB
          })

          for (const letter of sortedLetters) {
            const items = letterMap.get(letter)!
            if (items.length > 0) {
              result.push({
                title: letter,
                items: sortItems(items, sortBy, sortOrder),
                type: 'watchables'
              })
            }
          }
          break
        }
      }

      set({ groupedContent: result })
    },

    toggleFavorite: (watchable) => {
      const { currentUsername, currentUUID, setUserData, favoriteGroup } = get()
      if (!currentUsername || !currentUUID) return

      const currentFavorite = watchable.userData.favorite?.value ?? false
      const newFavoriteValue = !currentFavorite
      const now = Date.now()

      watchable.userData.favorite = {
        value: newFavoriteValue,
        updatedAt: now
      }

      setUserData(prev => ({
        ...prev,
        watchables: {
          ...prev.watchables,
          [watchable.Url]: watchable.userData
        }
      }))

      if (newFavoriteValue) {
        favoriteGroup.AddWatchable(watchable)
        toast.success('Added to favorites')
      } else {
        favoriteGroup.RemoveWatchable(watchable)
        toast.info('Removed from favorites')
      }
    },

    saveWatchProgress: (watchable, position, duration) => {
      const { currentUsername, currentUUID, setUserData, watchedGroup } = get()
      if (!currentUsername || !currentUUID) return
      if (watchable.category === 'LiveStream') return

      const progress = secondsToProgress(position, duration)
      const now = Date.now()
      const isWatched = progress > 0.95

      const previousWatchedTimestamp = watchable.userData.watchProgress?.watched
      const wasAlreadyWatched = previousWatchedTimestamp !== null && previousWatchedTimestamp !== undefined

      const previousProgress = watchable.userData.watchProgress?.progress ?? 0
      if (wasAlreadyWatched && progress === 0 && previousProgress === 0) {
        return
      }

      const progressToSave = isWatched ? 0 : progress

      watchable.userData.watchProgress = {
        progress: progressToSave,
        updatedAt: now,
        watched: wasAlreadyWatched ? previousWatchedTimestamp : (isWatched ? now : null)
      }

      setUserData(prev => ({
        ...prev,
        watchables: {
          ...prev.watchables,
          [watchable.Url]: watchable.userData
        }
      }))

      if (isWatched && !wasAlreadyWatched) {
        watchedGroup.AddWatchable(watchable)
      }
    },

    toggleHidden: (watchable) => {
      const { currentUsername, currentUUID, setUserData } = get()
      if (!currentUsername || !currentUUID) return

      const currentHidden = watchable.userData.hidden?.value ?? false
      const newHiddenValue = !currentHidden
      const now = Date.now()

      watchable.userData.hidden = {
        value: newHiddenValue,
        updatedAt: now
      }

      setUserData(prev => ({
        ...prev,
        watchables: {
          ...prev.watchables,
          [watchable.Url]: watchable.userData
        }
      }))

      if (newHiddenValue) {
        toast.info('Item hidden')
      } else {
        toast.info('Item unhidden')
      }
    },

    saveTrackSelection: (watchable, audioTrack, subtitleTrack) => {
      const { currentUsername, currentUUID, setUserData } = get()
      if (!currentUsername || !currentUUID) return

      const now = Date.now()

      watchable.userData.tracks = {
        audio: audioTrack,
        subtitle: subtitleTrack,
        updatedAt: now
      }

      setUserData(prev => ({
        ...prev,
        watchables: {
          ...prev.watchables,
          [watchable.Url]: watchable.userData
        }
      }))
    },

    getNextEpisode: (currentItem) => {
      if (currentItem.category !== 'Series') return undefined
      const tvShow = currentItem as TvShowWatchableObject
      const seasonGroup = tvShow.UpperLevel as TvShowSeasonGroupObject

      const watchable = seasonGroup.getEpisode(tvShow.Episode + 1)
      if (watchable) {
        return watchable
      }

      const tvShowGroup = seasonGroup.UpperLevel as TvShowGroupObject
      return tvShowGroup.getEpisode(seasonGroup.Season + 1, 1)
    },

    getPreviousEpisode: (currentItem) => {
      if (currentItem.category !== 'Series') return undefined

      const tvShow = currentItem as TvShowWatchableObject
      const seasonGroup = tvShow.UpperLevel as TvShowSeasonGroupObject

      const prevEpisode = tvShow.Episode - 1
      if (prevEpisode > 0) {
        return seasonGroup.getEpisode(prevEpisode)
      }

      const prevSeason = seasonGroup.Season - 1
      if (prevSeason > 0) {
        const tvShowGroup = seasonGroup.UpperLevel as TvShowGroupObject
        const prevSeasonGroup = tvShowGroup.getSeason(prevSeason)

        if (prevSeasonGroup) {
          return prevSeasonGroup.getEpisode(prevSeasonGroup.episodeCount)
        }
      }

      return undefined
    },

    findByUrl: (url) => {
      const { movieGroup, tvShowGroup, streamGroup } = get()
      return (
        movieGroup.findByUrl(url) ??
        tvShowGroup.findByUrl(url) ??
        streamGroup.findByUrl(url)
      )
    },

    calculateStats: () => {
      const { movieGroup, tvShowGroup, streamGroup } = get()

      const countGroups = (group: GroupObject): number => {
        return group.Groups.length + group.Groups.reduce((total, g) => total + countGroups(g), 0)
      }

      const movieCount = movieGroup.TotalCount
      const tvShowCount = tvShowGroup.TvShowCount
      const tvShowEpisodeCount = tvShowGroup.TvShowEpisodeCount
      const liveStreamCount = streamGroup.TotalCount

      const groupCount = countGroups(movieGroup) + countGroups(tvShowGroup) + countGroups(streamGroup)
      const totalWatchables = movieCount + tvShowEpisodeCount + liveStreamCount

      return {
        groupCount,
        tvShowCount,
        liveStreamCount,
        movieCount,
        totalWatchables,
      }
    },

    syncM3UData: async (uuid, source, update, stats) => {
      await fileSystem.writeFile(getM3USource(uuid), source)
      await fileSystem.writeJSON(getM3UUpdate(uuid), update)
      await fileSystem.writeJSON(getM3UStats(uuid), stats)
    },
  }))
}
