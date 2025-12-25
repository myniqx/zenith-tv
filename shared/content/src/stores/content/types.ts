import type { GroupObject, WatchableObject } from '../../models'
import type { M3UObject } from '../../types/m3u-types'
import { ProfileSyncPayload } from '../../types/p2p'
import type { UserItemData } from '../../types/user-data'
import type { FileSyncedState } from '../tools/fileSync'

export type CategoryType = 'all' | 'movies' | 'series' | 'live' | 'favorites' | 'recent'
export type SortBy = 'name' | 'date' | 'recent'
export type SortOrder = 'asc' | 'desc'
export type GroupBy = 'none' | 'group' | 'year' | 'alphabetic'

export interface LayoutData {
  categoryBrowser: number
  contentBrowser: number
}

export interface PlayerData {
  sortBy: SortBy
  sortOrder: SortOrder
  groupBy: GroupBy
}

export interface UserData {
  watchables: Record<string, UserItemData>
  hiddenGroups: string[]
  stickyGroups: string[]
  playerData: PlayerData
  layoutData: LayoutData
}

export interface ContentGroupData {
  title: string
  items: WatchableObject[] | GroupObject[]
  type: 'groups' | 'watchables'
}

export interface M3UUpdateData {
  items: Record<string, number>
  createdAt: number
  updatedAt: number
}

export interface M3UStats {
  groupCount: number
  tvShowCount: number
  liveStreamCount: number
  movieCount: number
  totalWatchables: number
}

export type ContentState = FileSyncedState<UserData, 'userData'> & {
  items: WatchableObject[]
  recentItems: WatchableObject[]
  favoritesItems: WatchableObject[]
  currentGroup: GroupObject | null
  searchQuery: string
  sortBy: SortBy
  sortOrder: SortOrder
  groupBy: GroupBy
  groupedContent: ContentGroupData[]
  isLoading: boolean
  currentUsername: string | null
  currentUUID: string | null
  currentM3UUrl: string | null

  movieGroup: GroupObject
  tvShowGroup: GroupObject
  streamGroup: GroupObject
  recentGroup: GroupObject
  favoriteGroup: GroupObject
  watchedGroup: GroupObject

  reset: () => void
  setContent: (username: string, uuid: string) => Promise<void>
  load: (fromUpdate?: boolean) => Promise<void>
  update: () => Promise<void>
  setGroup: (group: GroupObject | null) => void
  setSearchQuery: (query: string) => void
  setSortBy: (sortBy: SortBy) => void
  setSortOrder: (order: SortOrder) => void
  setGroupBy: (groupBy: GroupBy) => void
  updateGroupedContent: () => void

  toggleFavorite: (watchable: WatchableObject) => void
  toggleHidden: (watchable: WatchableObject) => void
  saveWatchProgress: (watchable: WatchableObject, position: number, duration: number) => void
  saveTrackSelection: (watchable: WatchableObject, audioTrack?: number, subtitleTrack?: number) => void

  getNextEpisode: (currentItem: WatchableObject) => WatchableObject | undefined
  getPreviousEpisode: (currentItem: WatchableObject) => WatchableObject | undefined
  calculateStats: () => M3UStats
  syncM3UData: (uuid: string, source: string, update: M3UUpdateData, stats: M3UStats) => Promise<void>


  getWellComePayload: () => ProfileSyncPayload | null;
}

/**
 * Dependencies required by content store
 */
export interface ContentStoreDependencies {
  fileSystem: {
    readFile: (path: string) => Promise<string>
    writeFile: (path: string, content: string) => Promise<void>
    readJSON: <T>(path: string) => Promise<T>
    writeJSON: <T>(path: string, data: T) => Promise<void>
    readJSONOrDefault: <T>(path: string, defaultValue: T) => Promise<T>
    ensureFile: <T>(path: string, defaultData: T) => Promise<T>
  }
  http: {
    fetchM3U: (url: string, onProgress?: (progress: number) => void) => Promise<string>
  }
  parseM3U: (source: string) => Promise<M3UObject[]>
  toast: {
    success: (message: string, duration?: number) => void
    error: (message: string, duration?: number) => void
    info: (message: string, duration?: number) => void
  }
  getUrlFromUUID: (uuid: string) => string | null
  setLastProfile: (username: string, uuid: string) => void
}
