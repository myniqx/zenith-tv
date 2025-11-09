import { create } from 'zustand';
import type { Profile } from '@zenith-tv/types';
import { db } from '../services/database';
import { fetchAndParseM3U } from '../services/m3u-parser';
import { useContentStore } from './content';
import { useToastStore } from './toast';

interface ProfilesState {
  profiles: Profile[];
  currentProfile: Profile | null;
  isLoading: boolean;
  syncProgress: {
    stage: string;
    percent: number;
  } | null;

  // Actions
  addProfile: (url: string, name: string) => Promise<void>;
  addProfileFromFile: () => Promise<void>;
  selectProfile: (profile: Profile) => void;
  deleteProfile: (id: number) => Promise<void>;
  loadProfiles: () => Promise<void>;
  syncProfile: (profile: Profile, force?: boolean) => Promise<void>;
}

export const useProfilesStore = create<ProfilesState>((set, get) => ({
  profiles: [],
  currentProfile: null,
  isLoading: false,
  syncProgress: null,

  loadProfiles: async () => {
    set({ isLoading: true });
    try {
      const profiles = await db.getProfiles();
      set({ profiles });
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addProfile: async (url, name) => {
    set({ isLoading: true });
    try {
      await db.addProfile(name, url);
      await get().loadProfiles();
      useToastStore.getState().success(`Profile "${name}" added successfully`);
    } catch (error) {
      console.error('Failed to add profile:', error);
      useToastStore.getState().error('Failed to add profile');
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

      // Parse M3U content directly
      const { parseM3U } = await import('../services/m3u-parser');
      const items = await parseM3U(result.content);

      if (items.length === 0) {
        useToastStore.getState().warning('No valid items found in M3U file');
        set({ isLoading: false, syncProgress: null });
        return;
      }

      // Create profile with file:// URL
      const profileName = result.name.replace(/\.m3u8?$/i, '');
      const profileId = await db.addProfile(profileName, `file://${result.path}`);

      // Save items to database
      set({ syncProgress: { stage: 'Saving items...', percent: 50 } });
      const convertedItems = items.map(item => ({
        title: item.title,
        url: item.url,
        group: item.group,
        logo: item.logo,
        category: item.category,
        profileId,
        addedDate: new Date(),
        isFavorite: false,
      }));

      const newItemUrls = await db.upsertItems(profileId, convertedItems);

      // Add to recent
      if (newItemUrls.length > 0) {
        await db.addToRecent(newItemUrls);
      }

      // Update profile
      await db.updateProfileSync(profileId, items.length);
      await get().loadProfiles();

      set({ syncProgress: { stage: 'Complete!', percent: 100 } });
      useToastStore.getState().success(
        `Imported "${profileName}" with ${items.length} items`
      );

      // Auto-select the new profile
      const newProfile = (await db.getProfiles()).find(p => p.id === profileId);
      if (newProfile) {
        get().selectProfile(newProfile);
      }
    } catch (error) {
      console.error('Failed to import from file:', error);
      useToastStore.getState().error('Failed to import M3U file');
    } finally {
      set({ isLoading: false, syncProgress: null });
    }
  },

  selectProfile: (profile) => {
    set({ currentProfile: profile });

    // Load items for this profile
    useContentStore.getState().loadItemsForProfile(profile.id);
  },

  deleteProfile: async (id) => {
    set({ isLoading: true });
    try {
      const profile = get().profiles.find(p => p.id === id);
      await db.deleteProfile(id);

      const { currentProfile } = get();
      if (currentProfile?.id === id) {
        set({ currentProfile: null });
        useContentStore.getState().clearItems();
      }

      await get().loadProfiles();
      useToastStore.getState().success(`Profile "${profile?.name}" deleted`);
    } catch (error) {
      console.error('Failed to delete profile:', error);
      useToastStore.getState().error('Failed to delete profile');
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  syncProfile: async (profile, force = false) => {
    set({ isLoading: true, syncProgress: { stage: 'Starting...', percent: 0 } });

    try {
      // Fetch and parse M3U
      const items = await fetchAndParseM3U(
        profile.m3uUrl,
        profile.id,
        (stage, percent) => {
          set({ syncProgress: { stage, percent: percent || 0 } });
        }
      );

      // Save to database
      set({ syncProgress: { stage: 'Saving to database...', percent: 0 } });
      const newItemUrls = await db.upsertItems(profile.id, items);

      // Add new items to recent
      if (newItemUrls.length > 0) {
        await db.addToRecent(newItemUrls);
      }

      // Update profile sync time and item count
      await db.updateProfileSync(profile.id, items.length);

      // Reload profiles to update counts
      await get().loadProfiles();

      // Reload items if this is the current profile
      if (get().currentProfile?.id === profile.id) {
        await useContentStore.getState().loadItemsForProfile(profile.id);
      }

      set({ syncProgress: { stage: 'Complete!', percent: 100 } });

      // Show success toast
      const newCount = newItemUrls.length;
      if (newCount > 0) {
        useToastStore.getState().success(`Sync complete! Added ${newCount} new items`);
      } else {
        useToastStore.getState().info('Sync complete! No new items found');
      }

      // Clear progress after 2 seconds
      setTimeout(() => {
        set({ syncProgress: null });
      }, 2000);

    } catch (error) {
      console.error('Failed to sync profile:', error);
      set({ syncProgress: null });
      useToastStore.getState().error('Failed to sync profile. Please check the M3U URL');
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
}));
