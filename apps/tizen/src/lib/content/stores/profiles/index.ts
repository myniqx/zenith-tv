import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useToastStore } from '../toast'
import type { Profile, ProfilesStoreDeps, ProfilesState } from '../../types/profiles'

export const createProfilesStore = (deps: ProfilesStoreDeps, persistKey: string) => {
  const { fileSystem, getContentStore, dialog, http, parseM3U } = deps

  return create<ProfilesState>()(
    persist(
      (set, get) => ({
        profiles: [],
        m3uMap: {},

        getCurrentUsername: () => getContentStore()?.currentUsername ?? null,
        getCurrentUUID: () => getContentStore()?.currentUUID ?? null,

        getUrlFromUUID: (uuid) => {
          const { m3uMap } = get()
          return Object.entries(m3uMap).find(([_, id]) => id === uuid)?.[0] ?? null
        },

        getUUIDFromURL: (url) => {
          const { m3uMap } = get()
          return m3uMap[url] ?? null
        },

        getOrCreateUUID: (url) => {
          const { m3uMap } = get()
          if (m3uMap[url]) return m3uMap[url]

          const uuid = crypto.randomUUID()
          set((state) => ({ m3uMap: { ...state.m3uMap, [url]: uuid } }))
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
          return get().profiles.some((p) => p.m3uRefs.includes(uuid))
        },

        cleanupUnusedUUID: async (uuid) => {
          const { isUUIDUsed, m3uMap } = get()
          if (isUUIDUsed(uuid)) return

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
          set((state) => ({ profiles: [...state.profiles, newProfile] }))
          useToastStore.getState().success(`Profile "${username}" created`)
        },

        createProfileFromFile: async (username) => {
          if (!dialog || !http || !parseM3U) return null

          try {
            const filePath = await dialog.pickM3UFile()
            if (!filePath) return null

            const fileUrl = `file://${filePath}`
            const content = await http.fetchM3U(fileUrl)
            const items = await parseM3U(content)

            if (!items?.length) {
              useToastStore.getState().warning('No valid items found in M3U file')
              return null
            }

            const { profiles, getOrCreateUUID } = get()
            if (profiles.some((p) => p.username === username)) {
              useToastStore.getState().error('Profile already exists')
              return null
            }

            const uuid = getOrCreateUUID(fileUrl)
            const newProfile: Profile = {
              username,
              createdAt: Date.now(),
              m3uRefs: [uuid],
              lastLogin: Date.now(),
            }
            set((state) => ({ profiles: [...state.profiles, newProfile] }))
            useToastStore.getState().success(`Profile "${username}" created from file`)
            return { username, uuid }
          } catch (error) {
            console.error('Failed to create profile from file:', error)
            useToastStore.getState().error('Failed to import M3U file')
            return null
          }
        },

        deleteProfile: async (username) => {
          const { profiles, cleanupUnusedUUID } = get()
          const store = getContentStore()

          const profile = profiles.find((p) => p.username === username)
          if (!profile) throw new Error('Profile not found')

          const uuidsToCleanup = profile.m3uRefs

          if (store?.currentUsername === username) {
            store.reset()
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

          const selectedUUID = uuid ?? profile.lastSelectedUUID ?? profile.m3uRefs[0]
          if (!selectedUUID) {
            useToastStore.getState().warning('No M3U sources in this profile')
            return
          }

          set((state) => ({
            profiles: state.profiles.map((p) =>
              p.username === username
                ? { ...p, lastLogin: Date.now(), lastSelectedUUID: selectedUUID }
                : p
            ),
          }))

          await store?.setContent(username, selectedUUID)
        },

        addM3UToProfile: (username, m3uUrl) => {
          const { profiles, getOrCreateUUID } = get()
          const uuid = getOrCreateUUID(m3uUrl)

          const profile = profiles.find((p) => p.username === username)
          if (!profile) throw new Error('Profile not found')

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
          const { profiles, cleanupUnusedUUID } = get()
          const store = getContentStore()

          const profile = profiles.find((p) => p.username === username)
          if (!profile) throw new Error('Profile not found')

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

          if (store?.currentUUID === uuid) {
            store.reset()
          }

          await cleanupUnusedUUID(uuid)
          useToastStore.getState().success('M3U removed from profile')
        },

        getProfile: (username) => get().profiles.find((p) => p.username === username),

        getAllProfiles: () => get().profiles,
      }),
      { name: persistKey }
    )
  )
}
