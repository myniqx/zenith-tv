import { createProfilesStore } from '@zenith-tv/content'
import { fileSystem } from '@/lib/filesystem'
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
  },
  'zenith-tizen-profiles'
)

export type { Profile } from '@zenith-tv/content'
