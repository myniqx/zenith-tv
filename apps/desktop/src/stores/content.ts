import { createContentStore } from '@zenith-tv/content'
import { useToastStore } from '@zenith-tv/content'
import { fileSystem, http } from '@/libs'
import { parseM3U } from '../services/m3u-parser'
import { useProfilesStore } from './profiles'
import { useSettingsStore } from './settings'

/**
 * Desktop implementation of content store
 * Uses shared content store factory with Desktop-specific dependencies
 */
export const useContentStore = createContentStore({
  fileSystem,
  http,
  parseM3U,
  toast: {
    success: (message, duration) => useToastStore.getState().success(message, duration),
    error: (message, duration) => useToastStore.getState().error(message, duration),
    info: (message, duration) => useToastStore.getState().info(message, duration),
  },
  getUrlFromUUID: (uuid) => useProfilesStore.getState().getUrlFromUUID(uuid),
  setLastProfile: (username, uuid) => useSettingsStore.getState().setLastProfile(username, uuid),
})

// Make store available globally to avoid circular dependency with profiles store
;(globalThis as any).__zenith_content_store = useContentStore

// Re-export types for backward compatibility
export type { ContentState, CategoryType, SortBy, SortOrder, GroupBy, UserData, M3UStats, M3UUpdateData, StatusMessage, StatusKind } from '@zenith-tv/content'
