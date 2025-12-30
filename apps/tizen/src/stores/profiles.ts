import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useToastStore } from '@zenith-tv/content'
import { fileSystem } from '@/lib/filesystem'

// Lazy getter to avoid circular dependency
// Import happens at runtime, not at module initialization
const getContentStore = () => {
  // Dynamic require would be: require('./content').useContentStore
  // But in ESM, we access it via a getter function that runs after both modules are loaded
  return (globalThis as any).__zenith_content_store
}

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
  cleanupUnusedUUID: (uuid: string) => Promise<void>

  // Current state getters (from content store)
  getCurrentUsername: () => string | null
  getCurrentUUID: () => string | null

  // Profile actions
  createProfile: (username: string) => void
  deleteProfile: (username: string) => Promise<void>
  selectProfile: (username: string, uuid?: string) => Promise<void>
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

      // Current state getters (from content store)
      getCurrentUsername: () => {
        const store = getContentStore()
        if (!store) return null
        return store.getState().currentUsername
      },

      getCurrentUUID: () => {
        const store = getContentStore()
        if (!store) return null
        return store.getState().currentUUID
      },

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

      cleanupUnusedUUID: async (uuid) => {
        const { isUUIDUsed, m3uMap } = get()

        if (isUUIDUsed(uuid)) {
          return
        }

        try {
          const m3uPath = `m3u/${uuid}`
          const exists = await fileSystem.exists(m3uPath)

          if (exists) {
            await fileSystem.delete(m3uPath)
            console.log(`[Cleanup] Deleted unused M3U directory: ${m3uPath}`)
          }

          const urlToRemove = Object.keys(m3uMap).find((url) => m3uMap[url] === uuid)
          if (urlToRemove) {
            set((state) => {
              const newMap = { ...state.m3uMap }
              delete newMap[urlToRemove]
              return { m3uMap: newMap }
            })
            console.log(`[Cleanup] Removed M3U URL mapping: ${urlToRemove}`)
          }
        } catch (error) {
          console.error(`[Cleanup] Failed to cleanup UUID ${uuid}:`, error)
        }
      },

      // Profile actions
      createProfile: (username) => {
        const { profiles } = get()

        if (profiles.some((p) => p.username === username)) {
          useToastStore.getState().error('Profile already exists')
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
        useToastStore.getState().success(`Profile "${username}" created`)
      },

      deleteProfile: async (username) => {
        const { profiles, cleanupUnusedUUID, getCurrentUsername } = get()
        const store = getContentStore()

        const currentUsername = getCurrentUsername()

        const profile = profiles.find((p) => p.username === username)
        if (!profile) {
          throw new Error('Profile not found')
        }

        const uuidsToCleanup = profile.m3uRefs || []

        if (currentUsername === username && store) {
          store.getState().reset()
        }

        set((state) => ({
          profiles: state.profiles.filter((p) => p.username !== username),
        }))

        for (const uuid of uuidsToCleanup) {
          await cleanupUnusedUUID(uuid)
        }

        useToastStore.getState().success(`Profile "${username}" deleted`)
      },

      selectProfile: async (username, uuid?) => {
        const { profiles } = get()
        const store = getContentStore()

        const profile = profiles.find((p) => p.username === username)
        if (!profile) {
          useToastStore.getState().error('Profile not found')
          return
        }

        const selectedUUID = uuid || profile.m3uRefs[0]

        if (!selectedUUID) {
          useToastStore.getState().warning('No M3U sources in this profile')
          return
        }

        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.username === username ? { ...p, lastLogin: Date.now() } : p
          ),
        }))

        if (store) {
          await store.getState().setContent(username, selectedUUID)
        }
      },

      addM3UToProfile: (username, m3uUrl) => {
        const { profiles, getOrCreateUUID } = get()

        const uuid = getOrCreateUUID(m3uUrl)

        const profile = profiles.find((p) => p.username === username)
        if (!profile) {
          throw new Error('Profile not found')
        }

        if (profile.m3uRefs.includes(uuid)) {
          useToastStore.getState().info('M3U already in profile')
          return uuid
        }

        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.username === username ? { ...p, m3uRefs: [...p.m3uRefs, uuid] } : p
          ),
        }))

        useToastStore.getState().success('M3U added to profile')
        return uuid
      },

      removeM3UFromProfile: async (username, uuid) => {
        const { profiles, getCurrentUUID, cleanupUnusedUUID } = get()
        const store = getContentStore()

        const currentUUID = getCurrentUUID()

        const profile = profiles.find((p) => p.username === username)
        if (!profile) {
          throw new Error('Profile not found')
        }

        if (!profile.m3uRefs.includes(uuid)) {
          useToastStore.getState().warning('M3U not found in profile')
          return
        }

        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.username === username
              ? { ...p, m3uRefs: p.m3uRefs.filter((ref) => ref !== uuid) }
              : p
          ),
        }))

        if (currentUUID === uuid && store) {
          store.getState().reset()
        }

        await cleanupUnusedUUID(uuid)

        useToastStore.getState().success('M3U removed from profile')
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
