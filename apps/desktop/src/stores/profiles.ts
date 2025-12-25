import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseM3U } from '../services/m3u-parser';
import { useToastStore } from '@zenith-tv/content';
import { useContentStore } from './content';
import { Profile } from '@/types/profiles';
import { dialog, fileSystem, http } from '@/libs';

/**
 * M3U URL to UUID mapping
 * Key: M3U URL, Value: UUID
 */
type M3UMap = Record<string, string>;

type ProfilesState = {
  profiles: Profile[];
  m3uMap: M3UMap;

  // M3U Map helpers
  getUrlFromUUID: (uuid: string) => string | null;
  getUUIDFromURL: (url: string) => string | null;
  getOrCreateUUID: (url: string) => string;
  removeURLMapping: (url: string) => void;
  isUUIDUsed: (uuid: string) => boolean;
  cleanupUnusedUUID: (uuid: string) => Promise<void>;

  // Current state getters (from content store)
  getCurrentUsername: () => string | null;
  getCurrentUUID: () => string | null;

  // Profile actions
  createProfile: (username: string) => void;
  createProfileFromFile: (username: string) => Promise<{ username: string; uuid: string } | null>;
  deleteProfile: (username: string) => Promise<void>;
  selectProfile: (username: string, uuid?: string) => Promise<void>;
  addM3UToProfile: (username: string, m3uUrl: string) => string;
  removeM3UFromProfile: (username: string, uuid: string) => Promise<void>;
};

export const useProfilesStore = create<ProfilesState>()(
  persist(
    (set, get) => ({
      profiles: [],
      m3uMap: {},

      // Current state getters (from content store)
      getCurrentUsername: () => {
        return useContentStore.getState().currentUsername;
      },

      getCurrentUUID: () => {
        return useContentStore.getState().currentUUID;
      },

      // M3U Map helpers
      getUrlFromUUID: (uuid) => {
        const { m3uMap } = get();
        return Object.entries(m3uMap).find(([_, id]) => id === uuid)?.[0] || null;
      },

      getUUIDFromURL: (url) => {
        const { m3uMap } = get();
        return m3uMap[url] || null;
      },

      getOrCreateUUID: (url) => {
        const { m3uMap } = get();

        if (m3uMap[url]) {
          return m3uMap[url];
        }

        // Generate UUID v4
        const uuid = window.crypto.randomUUID();

        set((state) => ({
          m3uMap: {
            ...state.m3uMap,
            [url]: uuid,
          },
        }));

        return uuid;
      },

      removeURLMapping: (url) => {
        set((state) => {
          const newMap = { ...state.m3uMap };
          delete newMap[url];
          return { m3uMap: newMap };
        });
      },

      isUUIDUsed: (uuid) => {
        const { profiles } = get();
        return profiles.some((profile) => profile.m3uRefs.includes(uuid));
      },

      cleanupUnusedUUID: async (uuid) => {
        const { isUUIDUsed, m3uMap } = get();

        // Check if UUID is still used by any profile
        if (isUUIDUsed(uuid)) {
          return; // Still in use, don't delete
        }

        try {
          // Delete /m3u/{uuid} directory and its contents
          const m3uPath = `m3u/${uuid}`;
          const exists = await fileSystem.exists(m3uPath);

          if (exists) {
            await fileSystem.delete(m3uPath);
            console.log(`[Cleanup] Deleted unused M3U directory: ${m3uPath}`);
          }

          // Remove URL mapping from m3uMap
          const urlToRemove = Object.keys(m3uMap).find((url) => m3uMap[url] === uuid);
          if (urlToRemove) {
            set((state) => {
              const newMap = { ...state.m3uMap };
              delete newMap[urlToRemove];
              return { m3uMap: newMap };
            });
            console.log(`[Cleanup] Removed M3U URL mapping: ${urlToRemove}`);
          }
        } catch (error) {
          console.error(`[Cleanup] Failed to cleanup UUID ${uuid}:`, error);
        }
      },

      // Profile actions
      createProfile: (username) => {
        const { profiles } = get();

        if (profiles.some((p) => p.username === username)) {
          useToastStore.getState().error('Profile already exists');
          throw new Error('Profile already exists');
        }

        const newProfile: Profile = {
          username,
          createdAt: Date.now(),
          m3uRefs: [],
          lastLogin: Date.now(),
        };

        set((state) => ({
          profiles: [...state.profiles, newProfile],
        }));
        useToastStore.getState().success(`Profile "${username}" created`);
      },

      createProfileFromFile: async (username) => {
        try {
          const filePath = await dialog.pickM3UFile();
          if (!filePath) return null;

          const fileUrl = `file://${filePath}`;
          const content = await http.fetchM3U(fileUrl);
          const items = await parseM3U(content);

          if (!items?.length) {
            useToastStore.getState().warning('No valid items found in M3U file');
            return null;
          }

          const { profiles, getOrCreateUUID } = get();

          if (profiles.some((p) => p.username === username)) {
            useToastStore.getState().error('Profile already exists');
            return null;
          }

          const uuid = getOrCreateUUID(fileUrl);

          const newProfile: Profile = {
            username,
            createdAt: Date.now(),
            m3uRefs: [uuid],
            lastLogin: Date.now(),
          };

          set((state) => ({
            profiles: [...state.profiles, newProfile],
          }));
          useToastStore.getState().success(`Profile "${username}" created from file`);

          return { username, uuid };
        } catch (error) {
          console.error('Failed to create profile from file:', error);
          useToastStore.getState().error('Failed to import M3U file');
          return null;
        }
      },

      deleteProfile: async (username) => {
        const { profiles, cleanupUnusedUUID } = get();

        // Get current username before any state changes
        const currentUsername = useContentStore.getState().currentUsername;

        // Get profile's UUIDs before deleting
        const profile = profiles.find((p) => p.username === username);
        const uuidsToCleanup = profile?.m3uRefs || [];

        // Clear content if deleted profile was selected (before profile deletion)
        if (currentUsername === username) {
          useContentStore.getState().reset();
        }

        // Remove profile
        set((state) => ({
          profiles: state.profiles.filter((p) => p.username !== username),
        }));

        // Cleanup unused UUID files
        for (const uuid of uuidsToCleanup) {
          await cleanupUnusedUUID(uuid);
        }

        useToastStore.getState().success(`Profile "${username}" deleted`);
      },

      selectProfile: async (username, uuid?) => {
        const { profiles } = get();
        const profile = profiles.find((p) => p.username === username);

        if (!profile) {
          useToastStore.getState().error('Profile not found');
          return;
        }

        // If UUID provided, use it; otherwise use first M3U in profile
        const selectedUUID = uuid || profile.m3uRefs[0];

        if (!selectedUUID) {
          useToastStore.getState().warning('No M3U sources in this profile');
          return;
        }

        // Update lastLogin timestamp
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.username === username ? { ...p, lastLogin: Date.now() } : p
          ),
        }));

        // Update content store with selected profile and UUID
        await useContentStore.getState().setContent(username, selectedUUID);
      },

      addM3UToProfile: (username, m3uUrl) => {
        const { profiles, getOrCreateUUID } = get();

        const uuid = getOrCreateUUID(m3uUrl);

        const profile = profiles.find((p) => p.username === username);
        if (!profile) {
          throw new Error('Profile not found');
        }

        if (profile.m3uRefs.includes(uuid)) {
          useToastStore.getState().info('M3U already in profile');
          return uuid;
        }

        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.username === username ? { ...p, m3uRefs: [...p.m3uRefs, uuid] } : p
          ),
        }));

        useToastStore.getState().success('M3U added to profile');
        return uuid;
      },

      removeM3UFromProfile: async (username, uuid) => {
        const { profiles, getCurrentUUID, cleanupUnusedUUID } = get();
        const currentUUID = getCurrentUUID();

        const profile = profiles.find((p) => p.username === username);
        if (!profile) {
          throw new Error('Profile not found');
        }

        if (!profile.m3uRefs.includes(uuid)) {
          useToastStore.getState().warning('M3U not found in profile');
          return;
        }

        // Remove UUID from profile
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.username === username
              ? { ...p, m3uRefs: p.m3uRefs.filter((ref) => ref !== uuid) }
              : p
          ),
        }));

        // Clear content if removed M3U was selected
        if (currentUUID === uuid) {
          useContentStore.getState().reset();
        }

        // Cleanup unused UUID files
        await cleanupUnusedUUID(uuid);

        useToastStore.getState().success('M3U removed from profile');
      },
    }),
    {
      name: 'zenith-profiles',
    }
  )
);
