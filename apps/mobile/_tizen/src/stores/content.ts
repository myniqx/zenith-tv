import { createContentStore, useToastStore } from '@zenith-tv/content'
import { fileSystem } from '@/lib/filesystem'
import { http } from '@/lib/http'
import { parseM3U } from '@/services/m3u-parser'
import { useProfilesStore } from './profiles'
import { useSettingsStore } from './settings'

/**
 * Tizen implementation of content store
 * Uses shared content store factory with Tizen-specific dependencies
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

// Re-export types for convenience
export type { ContentState, CategoryType, SortBy, SortOrder, GroupBy } from '@zenith-tv/content'
