import { create } from 'zustand';
import { profileService, type BackendProfile } from '../services/profile-service';
import { m3uService, type M3UInfo } from '../services/m3u-service';
import { parseM3U } from '../services/m3u-parser';
import { useContentStore } from './content';
import { useToastStore } from './toast';

interface ProfilesState {
  profiles: BackendProfile[];
  currentUsername: string | null;
  currentM3U: M3UInfo | null;
  m3uList: M3UInfo[]; // M3Us for current profile
  isLoading: boolean;
  syncProgress: {
    stage: string;
    percent: number;
  } | null;

  // Actions
  loadProfiles: () => Promise<void>;
  addProfile: (username: string, m3uUrl: string) => Promise<void>;
  addProfileFromFile: () => Promise<void>;
  selectProfile: (username: string) => Promise<void>;
  selectM3U: (m3uInfo: M3UInfo) => void;
  deleteProfile: (username: string) => Promise<void>;
  syncM3U: (m3uInfo: M3UInfo, force?: boolean) => Promise<void>;
  addM3UToProfile: (username: string, m3uUrl: string) => Promise<void>;
  removeM3UFromProfile: (username: string, uuid: string) => Promise<void>;
  loadM3UsForProfile: (username: string) => Promise<void>;
}

export const useProfilesStore = create<ProfilesState>((set, get) => ({
  profiles: [],
  currentUsername: null,
  currentM3U: null,
  m3uList: [],
  isLoading: false,
  syncProgress: null,

  loadProfiles: async () => {
    set({ isLoading: true });
    try {
      const profiles = await profileService.getAll();
      set({ profiles });
    } catch (error) {
      console.error('Failed to load profiles:', error);
      useToastStore.getState().error('Failed to load profiles');
    } finally {
      set({ isLoading: false });
    }
  },

  addProfile: async (username, m3uUrl) => {
    set({ isLoading: true, syncProgress: { stage: 'Creating profile...', percent: 0 } });

    try {
      // Create profile
      await profileService.create(username);

      set({ syncProgress: { stage: 'Adding M3U...', percent: 20 } });

      // Add M3U to profile
      const { uuid } = await m3uService.addToProfile(username, m3uUrl);

      set({ syncProgress: { stage: 'Fetching M3U...', percent: 40 } });

      // Fetch and cache M3U content
      await m3uService.fetchAndCache(uuid, m3uUrl);

      // Parse M3U and save stats
      set({ syncProgress: { stage: 'Parsing M3U...', percent: 60 } });
      const content = await m3uService.loadSource(uuid);
      const parsedItems = await parseM3U(content);

      set({ syncProgress: { stage: 'Saving statistics...', percent: 80 } });
      await m3uService.saveStats(uuid, parsedItems);

      set({ syncProgress: { stage: 'Complete!', percent: 100 } });

      // Reload profiles
      await get().loadProfiles();

      useToastStore.getState().success(`Profile "${username}" created successfully`);

      // Auto-select the new profile
      await get().selectProfile(username);

      // Clear progress after 1 second
      setTimeout(() => {
        set({ syncProgress: null });
      }, 1000);
    } catch (error) {
      console.error('Failed to add profile:', error);
      set({ syncProgress: null });
      useToastStore.getState().error('Failed to create profile');
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  addProfileFromFile: async () => {
    try {
      const result = await window.electron.file.selectM3U();

      if (!result) {
        // User cancelled
        return;
      }

      set({ isLoading: true, syncProgress: { stage: 'Parsing file...', percent: 0 } });

      // Parse M3U content
      const items = await parseM3U(result.content);

      if (items.length === 0) {
        useToastStore.getState().warning('No valid items found in M3U file');
        set({ isLoading: false, syncProgress: null });
        return;
      }

      // Create profile with file name as username
      const username = result.name.replace(/\.m3u8?$/i, '');

      set({ syncProgress: { stage: 'Creating profile...', percent: 20 } });
      await profileService.create(username);

      // Add M3U with file:// URL
      set({ syncProgress: { stage: 'Importing M3U...', percent: 40 } });
      const { uuid } = await m3uService.addToProfile(username, `file://${result.path}`);

      // Cache the file content
      set({ syncProgress: { stage: 'Caching content...', percent: 60 } });
      await m3uService.fetchAndCache(uuid, `file://${result.path}`);

      // Save statistics
      set({ syncProgress: { stage: 'Saving statistics...', percent: 80 } });
      await m3uService.saveStats(uuid, items);

      set({ syncProgress: { stage: 'Complete!', percent: 100 } });

      useToastStore.getState().success(
        `Imported "${username}" with ${items.length} items`
      );

      // Reload profiles
      await get().loadProfiles();

      // Auto-select the new profile
      await get().selectProfile(username);

      setTimeout(() => {
        set({ syncProgress: null });
      }, 1000);
    } catch (error) {
      console.error('Failed to import from file:', error);
      useToastStore.getState().error('Failed to import M3U file');
      set({ syncProgress: null });
    } finally {
      set({ isLoading: false });
    }
  },

  selectProfile: async (username) => {
    set({ currentUsername: username, isLoading: true });

    try {
      // Load M3Us for this profile
      const m3uList = await m3uService.getProfileM3Us(username);
      set({ m3uList });

      // Auto-select first M3U if available
      if (m3uList.length > 0) {
        get().selectM3U(m3uList[0]);
      } else {
        set({ currentM3U: null });
        useContentStore.getState().clearItems();
      }
    } catch (error) {
      console.error('Failed to load M3Us for profile:', error);
      useToastStore.getState().error('Failed to load M3Us');
    } finally {
      set({ isLoading: false });
    }
  },

  selectM3U: (m3uInfo) => {
    set({ currentM3U: m3uInfo });

    const { currentUsername } = get();
    if (currentUsername) {
      // Load items for this M3U
      useContentStore.getState().loadItems(currentUsername, m3uInfo.uuid);
    }
  },

  deleteProfile: async (username) => {
    set({ isLoading: true });
    try {
      await profileService.delete(username);

      const { currentUsername } = get();
      if (currentUsername === username) {
        set({ currentUsername: null, currentM3U: null, m3uList: [] });
        useContentStore.getState().clearItems();
      }

      await get().loadProfiles();
      useToastStore.getState().success(`Profile "${username}" deleted`);
    } catch (error) {
      console.error('Failed to delete profile:', error);
      useToastStore.getState().error('Failed to delete profile');
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncM3U: async (m3uInfo, force = false) => {
    set({ isLoading: true, syncProgress: { stage: 'Starting sync...', percent: 0 } });

    try {
      // Listen to progress events
      m3uService.onUpdateProgress(({ uuid, progress }) => {
        if (uuid === m3uInfo.uuid) {
          set({ syncProgress: { stage: progress.stage || 'Syncing...', percent: progress.percent || 0 } });
        }
      });

      // Fetch and cache M3U
      set({ syncProgress: { stage: 'Downloading M3U...', percent: 25 } });
      await m3uService.fetchAndCache(m3uInfo.uuid, m3uInfo.url);

      // Parse M3U and save stats
      set({ syncProgress: { stage: 'Parsing M3U...', percent: 50 } });
      const content = await m3uService.loadSource(m3uInfo.uuid);
      const parsedItems = await parseM3U(content);

      // Calculate and save stats via IPC
      set({ syncProgress: { stage: 'Saving statistics...', percent: 75 } });
      await window.electron.m3u.saveStats(m3uInfo.uuid, parsedItems);

      set({ syncProgress: { stage: 'Complete!', percent: 100 } });

      // Reload M3Us to get updated stats
      const { currentUsername } = get();
      if (currentUsername) {
        await get().loadM3UsForProfile(currentUsername);
      }

      // Reload items if this is the current M3U
      if (get().currentM3U?.uuid === m3uInfo.uuid && currentUsername) {
        await useContentStore.getState().loadItems(currentUsername, m3uInfo.uuid);
      }

      useToastStore.getState().success('Sync complete!');

      // Clear progress after 2 seconds
      setTimeout(() => {
        set({ syncProgress: null });
      }, 2000);
    } catch (error) {
      console.error('Failed to sync M3U:', error);
      set({ syncProgress: null });
      useToastStore.getState().error('Failed to sync M3U. Please check the URL');
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  addM3UToProfile: async (username, m3uUrl) => {
    set({ isLoading: true, syncProgress: { stage: 'Adding M3U...', percent: 0 } });

    try {
      // Add M3U to profile
      const { uuid, isNew } = await m3uService.addToProfile(username, m3uUrl);

      if (!isNew) {
        useToastStore.getState().info('M3U already exists in profile');
        set({ isLoading: false, syncProgress: null });
        return;
      }

      set({ syncProgress: { stage: 'Fetching M3U...', percent: 50 } });

      // Fetch and cache M3U content
      await m3uService.fetchAndCache(uuid, m3uUrl);

      set({ syncProgress: { stage: 'Complete!', percent: 100 } });

      // Reload M3Us for current profile
      if (get().currentUsername === username) {
        await get().loadM3UsForProfile(username);
      }

      useToastStore.getState().success('M3U added successfully');

      setTimeout(() => {
        set({ syncProgress: null });
      }, 1000);
    } catch (error) {
      console.error('Failed to add M3U:', error);
      set({ syncProgress: null });
      useToastStore.getState().error('Failed to add M3U');
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  removeM3UFromProfile: async (username, uuid) => {
    set({ isLoading: true });
    try {
      await m3uService.removeFromProfile(username, uuid);

      // If this was the current M3U, clear it
      if (get().currentM3U?.uuid === uuid) {
        set({ currentM3U: null });
        useContentStore.getState().clearItems();
      }

      // Reload M3Us for current profile
      if (get().currentUsername === username) {
        await get().loadM3UsForProfile(username);
      }

      useToastStore.getState().success('M3U removed successfully');
    } catch (error) {
      console.error('Failed to remove M3U:', error);
      useToastStore.getState().error('Failed to remove M3U');
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadM3UsForProfile: async (username) => {
    try {
      const m3uList = await m3uService.getProfileM3Us(username);
      set({ m3uList });

      // Update current M3U stats if it's in the list
      const { currentM3U } = get();
      if (currentM3U) {
        const updated = m3uList.find(m => m.uuid === currentM3U.uuid);
        if (updated) {
          set({ currentM3U: updated });
        }
      }
    } catch (error) {
      console.error('Failed to load M3Us:', error);
    }
  },
}));
