import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  lastProfile: {
    username: string | null
    uuid: string | null
  }

  setLastProfile: (username: string, uuid: string) => void
  clearLastProfile: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      lastProfile: {
        username: null,
        uuid: null,
      },

      setLastProfile: (username, uuid) => {
        set({ lastProfile: { username, uuid } })
      },

      clearLastProfile: () => {
        set({ lastProfile: { username: null, uuid: null } })
      },
    }),
    {
      name: 'zenith-tizen-settings',
    }
  )
)
