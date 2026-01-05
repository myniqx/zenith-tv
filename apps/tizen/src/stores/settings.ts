import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  lastProfile: {
    username: string | null
    uuid: string | null
  }

  // Playback preferences
  autoResume: boolean
  autoPlayNext: boolean
  preferredAudioLanguage: string | null
  preferredSubtitleLanguage: string | null

  setLastProfile: (username: string, uuid: string) => void
  clearLastProfile: () => void
  setAutoResume: (enabled: boolean) => void
  setAutoPlayNext: (enabled: boolean) => void
  setPreferredAudioLanguage: (language: string | null) => void
  setPreferredSubtitleLanguage: (language: string | null) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      lastProfile: {
        username: null,
        uuid: null,
      },

      autoResume: true,
      autoPlayNext: true,
      preferredAudioLanguage: null,
      preferredSubtitleLanguage: null,

      setLastProfile: (username, uuid) => {
        set({ lastProfile: { username, uuid } })
      },

      clearLastProfile: () => {
        set({ lastProfile: { username: null, uuid: null } })
      },

      setAutoResume: (enabled) => set({ autoResume: enabled }),
      setAutoPlayNext: (enabled) => set({ autoPlayNext: enabled }),
      setPreferredAudioLanguage: (language) => set({ preferredAudioLanguage: language }),
      setPreferredSubtitleLanguage: (language) => set({ preferredSubtitleLanguage: language }),
    }),
    {
      name: 'zenith-tizen-settings',
    }
  )
)
