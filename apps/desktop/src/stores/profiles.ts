import { createProfilesStore } from '@zenith-tv/content'
import { fileSystem, http, dialog } from '@/libs'
import { parseM3U } from '../services/m3u-parser'

// Lazy getter to break circular dependency: content.ts <-> profiles.ts
// content.ts assigns itself to globalThis after creation; by the time any
// store action is invoked both modules are fully initialized.
const getContentStore = () => {
  const state = (globalThis as any).__zenith_content_store?.getState() ?? null
  if (!state) return null
  return {
    currentUsername: state.currentUsername,
    currentUUID: state.currentUUID,
    reset: state.reset,
    setContent: state.setContent,
  }
}

export const useProfilesStore = createProfilesStore(
  {
    fileSystem,
    getContentStore,
    dialog: { pickM3UFile: dialog.pickM3UFile },
    http: { fetchM3U: http.fetchM3U },
    parseM3U: async (source) => {
      const items = await parseM3U(source)
      return items as Array<{ url: string; [key: string]: unknown }>
    },
  },
  'zenith-profiles'
)

export type { Profile } from '@zenith-tv/content'
