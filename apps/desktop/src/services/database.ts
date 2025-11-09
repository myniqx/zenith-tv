/**
 * Database Service
 * Wrapper around Electron IPC database calls
 */

import type { DBProfile, DBItem } from '../types/electron';
import type { WatchableItem, Profile } from '@zenith-tv/types';

/**
 * Convert DB profile to Profile type
 */
function convertProfile(dbProfile: DBProfile): Profile {
  return {
    id: dbProfile.id,
    name: dbProfile.name,
    m3uUrl: dbProfile.m3u_url,
    lastSync: dbProfile.last_sync ? new Date(dbProfile.last_sync) : undefined,
    itemCount: dbProfile.item_count,
  };
}

/**
 * Convert DB item to WatchableItem type
 */
function convertItem(dbItem: DBItem): WatchableItem {
  return {
    url: dbItem.url,
    title: dbItem.title,
    group: dbItem.group_name || '',
    logo: dbItem.logo || undefined,
    category:
      dbItem.category_type === 'series' && dbItem.series_name
        ? {
            type: 'series',
            episode: {
              seriesName: dbItem.series_name,
              season: dbItem.season || 0,
              episode: dbItem.episode || 0,
            },
          }
        : { type: dbItem.category_type },
    profileId: dbItem.profile_id,
    addedDate: new Date(dbItem.added_date),
    isFavorite: Boolean(dbItem.is_favorite),
    watchHistory: dbItem.position
      ? {
          lastWatched: new Date(dbItem.last_watched!),
          position: dbItem.position,
          duration: dbItem.duration || 0,
        }
      : undefined,
  };
}

export const db = {
  // Profiles
  async getProfiles(): Promise<Profile[]> {
    const profiles = await window.electron.db.getProfiles();
    return profiles.map(convertProfile);
  },

  async addProfile(name: string, url: string): Promise<number> {
    return await window.electron.db.addProfile(name, url);
  },

  async deleteProfile(id: number): Promise<void> {
    return await window.electron.db.deleteProfile(id);
  },

  async updateProfileSync(profileId: number, count: number): Promise<void> {
    return await window.electron.db.updateProfileSync(profileId, count);
  },

  // Items
  async getItemsByProfile(profileId: number): Promise<WatchableItem[]> {
    const items = await window.electron.db.getItemsByProfile(profileId);
    return items.map(convertItem);
  },

  async upsertItems(profileId: number, items: WatchableItem[]): Promise<string[]> {
    return await window.electron.db.upsertItems(profileId, items);
  },

  // Recent
  async getRecentItems(profileId: number): Promise<WatchableItem[]> {
    const items = await window.electron.db.getRecentItems(profileId);
    return items.map(convertItem);
  },

  async addToRecent(itemUrls: string[]): Promise<void> {
    return await window.electron.db.addToRecent(itemUrls);
  },

  // Favorites
  async toggleFavorite(itemUrl: string): Promise<boolean> {
    return await window.electron.db.toggleFavorite(itemUrl);
  },

  async getFavorites(profileId: number): Promise<WatchableItem[]> {
    const items = await window.electron.db.getFavorites(profileId);
    return items.map(convertItem);
  },

  // Watch History
  async saveWatchProgress(
    itemUrl: string,
    position: number,
    duration: number
  ): Promise<void> {
    return await window.electron.db.saveWatchProgress(itemUrl, position, duration);
  },

  async getWatchHistory(itemUrl: string) {
    return await window.electron.db.getWatchHistory(itemUrl);
  },

  // M3U Cache
  async getM3UCache(url: string): Promise<{
    url: string;
    content: string;
    etag?: string;
    last_modified?: string;
    cached_at: string;
    expires_at: string;
  } | null> {
    return await window.electron.db.getM3UCache(url);
  },

  async saveM3UCache(
    url: string,
    content: string,
    etag?: string,
    lastModified?: string,
    expiresInHours: number = 24
  ): Promise<void> {
    return await window.electron.db.saveM3UCache(url, content, etag, lastModified, expiresInHours);
  },

  async invalidateM3UCache(url: string): Promise<void> {
    return await window.electron.db.invalidateM3UCache(url);
  },

  async cleanExpiredCache(): Promise<void> {
    return await window.electron.db.cleanExpiredCache();
  },
};
