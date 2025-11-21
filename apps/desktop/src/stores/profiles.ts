import { create } from 'zustand';
import { parseM3U } from '../services/m3u-parser';
import { useToastStore } from './toast';
import { useContentStore } from './content';
import { Profile } from '@/types/profiles';
import { syncFile, type FileSyncedState } from '@/tools/fileSync';
import { dialog, fileSystem, http } from '@/libs';

/**
 * M3U URL to UUID mapping
 * Key: M3U URL, Value: UUID
 */
type M3UMap = Record<string, string>;

type ProfilesState = FileSyncedState<Profile[], 'profiles'> &
  FileSyncedState<M3UMap, 'm3uMap'> & {
    // M3U Map helpers
    getUUIDForURL: (url: string) => string | null;
    getOrCreateUUID: (url: string) => Promise<string>;
    removeURLMapping: (url: string) => Promise<void>;
    isUUIDUsed: (uuid: string) => boolean;
    cleanupUnusedUUID: (uuid: string) => Promise<void>;

    // Current state getters (from content store)
    getCurrentUsername: () => string | null;
    getCurrentUUID: () => string | null;

    // Profile actions
    createProfile: (username: string) => Promise<void>;
    createProfileFromFile: () => Promise<{ username: string; uuid: string } | null>;
    deleteProfile: (username: string) => Promise<void>;
    selectProfile: (username: string, uuid?: string) => Promise<void>;
    addM3UToProfile: (username: string, m3uUrl: string) => Promise<string>;
    removeM3UFromProfile: (username: string, uuid: string) => Promise<void>;
  };

export const useProfilesStore = create<ProfilesState>((set, get) => ({
  // File-synced profiles
  ...syncFile<Profile[], 'profiles'>('profiles.json', [], 'profiles')(set, get),

  // File-synced M3U URL → UUID mapping
  ...syncFile<M3UMap, 'm3uMap'>('m3uMap.json', {}, 'm3uMap')(set, get),

  // Current state getters (from content store)
  getCurrentUsername: () => {
    return useContentStore.getState().currentUsername;
  },

  getCurrentUUID: () => {
    return useContentStore.getState().currentUUID;
  },

  // M3U Map helpers
  getUUIDForURL: (url) => {
    const { m3uMap } = get();
    return m3uMap[url] || null;
  },

  getOrCreateUUID: async (url) => {
    const { m3uMap, setM3uMap } = get();

    if (m3uMap[url]) {
      return m3uMap[url];
    }

    // Generate UUID v4
    const uuid = window.crypto.randomUUID();

    await setM3uMap((prev) => ({
      ...prev,
      [url]: uuid,
    }));

    return uuid;
  },

  removeURLMapping: async (url) => {
    const { setM3uMap } = get();
    await setM3uMap((prev) => {
      const newMap = { ...prev };
      delete newMap[url];
      return newMap;
    });
  },

  isUUIDUsed: (uuid) => {
    const { profiles } = get();
    return profiles.some((profile) => profile.m3uRefs.includes(uuid));
  },

  cleanupUnusedUUID: async (uuid) => {
    const { isUUIDUsed, m3uMap, setM3uMap } = get();

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
        await setM3uMap((prev) => {
          const newMap = { ...prev };
          delete newMap[urlToRemove];
          return newMap;
        });
        console.log(`[Cleanup] Removed M3U URL mapping: ${urlToRemove}`);
      }
    } catch (error) {
      console.error(`[Cleanup] Failed to cleanup UUID ${uuid}:`, error);
    }
  },

  // Profile actions
  createProfile: async (username) => {
    const { profiles, setProfiles } = get();

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

    await setProfiles((prev) => [...prev, newProfile]);
    useToastStore.getState().success(`Profile "${username}" created`);
  },

  createProfileFromFile: async () => {
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

      const username = filePath.split(/[/\\]/).pop()?.replace(/\.m3u8?$/i, '') || 'Imported';

      const { profiles, setProfiles, getOrCreateUUID } = get();

      if (profiles.some((p) => p.username === username)) {
        useToastStore.getState().error('Profile already exists');
        return null;
      }

      const uuid = await getOrCreateUUID(fileUrl);

      const newProfile: Profile = {
        username,
        createdAt: Date.now(),
        m3uRefs: [uuid],
        lastLogin: Date.now(),
      };

      await setProfiles((prev) => [...prev, newProfile]);
      useToastStore.getState().success(`Profile "${username}" created from file`);

      return { username, uuid };
    } catch (error) {
      console.error('Failed to create profile from file:', error);
      useToastStore.getState().error('Failed to import M3U file');
      return null;
    }
  },

  deleteProfile: async (username) => {
    const { profiles, setProfiles, cleanupUnusedUUID } = get();

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
    await setProfiles((prev) => prev.filter((p) => p.username !== username));

    // Cleanup unused UUID files
    for (const uuid of uuidsToCleanup) {
      await cleanupUnusedUUID(uuid);
    }

    useToastStore.getState().success(`Profile "${username}" deleted`);
  },

  selectProfile: async (username, uuid?) => {
    const { profiles, setProfiles } = get();
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
    await setProfiles((prev) =>
      prev.map((p) =>
        p.username === username ? { ...p, lastLogin: Date.now() } : p
      )
    );

    // Update content store with selected profile and UUID
    await useContentStore.getState().setContent(username, selectedUUID);
  },

  addM3UToProfile: async (username, m3uUrl) => {
    const { profiles, setProfiles, getOrCreateUUID } = get();

    const uuid = await getOrCreateUUID(m3uUrl);

    const profile = profiles.find((p) => p.username === username);
    if (!profile) {
      throw new Error('Profile not found');
    }

    if (profile.m3uRefs.includes(uuid)) {
      useToastStore.getState().info('M3U already in profile');
      return uuid;
    }

    await setProfiles((prev) =>
      prev.map((p) =>
        p.username === username ? { ...p, m3uRefs: [...p.m3uRefs, uuid] } : p
      )
    );

    useToastStore.getState().success('M3U added to profile');
    return uuid;
  },

  removeM3UFromProfile: async (username, uuid) => {
    const { profiles, setProfiles, getCurrentUUID, cleanupUnusedUUID } = get();
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
    await setProfiles((prev) =>
      prev.map((p) =>
        p.username === username
          ? { ...p, m3uRefs: p.m3uRefs.filter((ref) => ref !== uuid) }
          : p
      )
    );

    // Clear content if removed M3U was selected
    if (currentUUID === uuid) {
      useContentStore.getState().reset();
    }

    // Cleanup unused UUID files
    await cleanupUnusedUUID(uuid);

    useToastStore.getState().success('M3U removed from profile');
  },
}));
