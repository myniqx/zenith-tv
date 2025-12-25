import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Profile {
  username: string
  createdAt: number
  m3uRefs: string[]
  lastLogin: number
}

type M3UMap = Record<string, string>

type ProfilesState = {
  profiles: Profile[]
  m3uMap: M3UMap

  // M3U Map helpers
  getUrlFromUUID: (uuid: string) => string | null
  getUUIDFromURL: (url: string) => string | null
  getOrCreateUUID: (url: string) => string
  removeURLMapping: (url: string) => void
  isUUIDUsed: (uuid: string) => boolean

  // Profile actions
  createProfile: (username: string) => void
  deleteProfile: (username: string) => Promise<void>
  addM3UToProfile: (username: string, m3uUrl: string) => string
  removeM3UFromProfile: (username: string, uuid: string) => Promise<void>
  getProfile: (username: string) => Profile | undefined
  getAllProfiles: () => Profile[]
}

export const useProfilesStore = create<ProfilesState>()(
  persist(
    (set, get) => ({
      profiles: [],
      m3uMap: {},

      // M3U Map helpers
      getUrlFromUUID: (uuid) => {
        const { m3uMap } = get()
        return Object.entries(m3uMap).find(([_, id]) => id === uuid)?.[0] || null
      },

      getUUIDFromURL: (url) => {
        const { m3uMap } = get()
        return m3uMap[url] || null
      },

      getOrCreateUUID: (url) => {
        const { m3uMap } = get()

        if (m3uMap[url]) {
          return m3uMap[url]
        }

        const uuid = crypto.randomUUID()

        set((state) => ({
          m3uMap: {
            ...state.m3uMap,
            [url]: uuid,
          },
        }))

        return uuid
      },

      removeURLMapping: (url) => {
        set((state) => {
          const newMap = { ...state.m3uMap }
          delete newMap[url]
          return { m3uMap: newMap }
        })
      },

      isUUIDUsed: (uuid) => {
        const { profiles } = get()
        return profiles.some((profile) => profile.m3uRefs.includes(uuid))
      },

      // Profile actions
      createProfile: (username) => {
        const { profiles } = get()

        if (profiles.some((p) => p.username === username)) {
          throw new Error('Profile already exists')
        }

        const newProfile: Profile = {
          username,
          createdAt: Date.now(),
          m3uRefs: [],
          lastLogin: Date.now(),
        }

        set((state) => ({
          profiles: [...state.profiles, newProfile],
        }))
      },

      deleteProfile: async (username) => {
        const { profiles } = get()

        const profile = profiles.find((p) => p.username === username)
        if (!profile) {
          throw new Error('Profile not found')
        }

        set((state) => ({
          profiles: state.profiles.filter((p) => p.username !== username),
        }))

        // Note: M3U cache cleanup will be handled by m3u store
      },

      addM3UToProfile: (username, m3uUrl) => {
        const { profiles, getOrCreateUUID } = get()

        const uuid = getOrCreateUUID(m3uUrl)

        const profile = profiles.find((p) => p.username === username)
        if (!profile) {
          throw new Error('Profile not found')
        }

        if (profile.m3uRefs.includes(uuid)) {
          return uuid
        }

        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.username === username ? { ...p, m3uRefs: [...p.m3uRefs, uuid] } : p
          ),
        }))

        return uuid
      },

      removeM3UFromProfile: async (username, uuid) => {
        const { profiles } = get()

        const profile = profiles.find((p) => p.username === username)
        if (!profile) {
          throw new Error('Profile not found')
        }

        if (!profile.m3uRefs.includes(uuid)) {
          return
        }

        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.username === username
              ? { ...p, m3uRefs: p.m3uRefs.filter((ref) => ref !== uuid) }
              : p
          ),
        }))

        // Note: M3U cache cleanup will be handled by m3u store
      },

      getProfile: (username) => {
        const { profiles } = get()
        return profiles.find((p) => p.username === username)
      },

      getAllProfiles: () => {
        return get().profiles
      },
    }),
    {
      name: 'zenith-tizen-profiles',
    }
  )
)
