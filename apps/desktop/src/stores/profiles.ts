import { createProfilesStore } from '@zenith-tv/content'
import { fileSystem, http, dialog } from '@/libs'
import { parseM3U } from '../services/m3u-parser'
import { useContentStore } from './content'

export const useProfilesStore = createProfilesStore(
  {
    fileSystem,
    getContentStore: () => {
      const state = useContentStore.getState()
      return {
        currentUsername: state.currentUsername,
        currentUUID: state.currentUUID,
        reset: state.reset,
        setContent: state.setContent,
      }
    },
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
