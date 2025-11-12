/**
 * User Data Service
 * Wrapper around Electron IPC user data management API
 * Handles favorites, watch progress, hidden items, track preferences
 */

export interface UserItemData {
  favorite?: boolean;
  hidden?: boolean;
  watchProgress?: number; // 0-100 percentage
  lastWatchedAt?: string;
  preferredAudioTrack?: string;
  preferredSubtitleTrack?: string;
}

export interface UserDataStats {
  totalFavorites: number;
  totalWatched: number;
  totalHidden: number;
}

export const userDataService = {
  /**
   * Get all user data for an M3U
   */
  async get(username: string, uuid: string): Promise<Record<string, UserItemData>> {
    return await window.electron.userData.get(username, uuid);
  },

  /**
   * Get user data for a specific item
   */
  async getItem(username: string, uuid: string, itemUrl: string): Promise<UserItemData | null> {
    return await window.electron.userData.getItem(username, uuid, itemUrl);
  },

  /**
   * Update user data for an item
   */
  async updateItem(
    username: string,
    uuid: string,
    itemUrl: string,
    updates: Partial<UserItemData>
  ): Promise<UserItemData> {
    return await window.electron.userData.updateItem(username, uuid, itemUrl, updates);
  },

  /**
   * Delete user data for an item
   */
  async deleteItem(username: string, uuid: string, itemUrl: string): Promise<void> {
    return await window.electron.userData.deleteItem(username, uuid, itemUrl);
  },

  /**
   * Toggle favorite status
   */
  async toggleFavorite(username: string, uuid: string, itemUrl: string): Promise<boolean> {
    return await window.electron.userData.toggleFavorite(username, uuid, itemUrl);
  },

  /**
   * Toggle hidden status
   */
  async toggleHidden(username: string, uuid: string, itemUrl: string): Promise<boolean> {
    return await window.electron.userData.toggleHidden(username, uuid, itemUrl);
  },

  /**
   * Update watch progress (0-100 percentage)
   */
  async updateWatchProgress(
    username: string,
    uuid: string,
    itemUrl: string,
    progress: number
  ): Promise<UserItemData> {
    return await window.electron.userData.updateWatchProgress(username, uuid, itemUrl, {
      progress,
      timestamp: Date.now(),
    });
  },

  /**
   * Mark item as watched (100% progress)
   */
  async markAsWatched(username: string, uuid: string, itemUrl: string): Promise<UserItemData> {
    return await window.electron.userData.markAsWatched(username, uuid, itemUrl);
  },

  /**
   * Save preferred audio/subtitle tracks
   */
  async saveTracks(
    username: string,
    uuid: string,
    itemUrl: string,
    audioTrack: string | null,
    subtitleTrack: string | null
  ): Promise<UserItemData> {
    return await window.electron.userData.saveTracks(username, uuid, itemUrl, audioTrack, subtitleTrack);
  },

  /**
   * Get all favorites across multiple M3Us
   */
  async getAllFavorites(username: string, uuids: string[]): Promise<any[]> {
    return await window.electron.userData.getAllFavorites(username, uuids);
  },

  /**
   * Get all recently watched items
   */
  async getAllRecentlyWatched(username: string, uuids: string[], limit?: number): Promise<any[]> {
    return await window.electron.userData.getAllRecentlyWatched(username, uuids, limit);
  },

  /**
   * Get stats for user data
   */
  async getStats(username: string, uuid: string): Promise<UserDataStats> {
    return await window.electron.userData.getStats(username, uuid);
  },

  /**
   * Get combined stats across multiple M3Us
   */
  async getCombinedStats(username: string, uuids: string[]): Promise<UserDataStats> {
    return await window.electron.userData.getCombinedStats(username, uuids);
  },

  /**
   * Clear old watch history
   */
  async clearOldHistory(username: string, uuid: string, daysToKeep?: number): Promise<number> {
    return await window.electron.userData.clearOldHistory(username, uuid, daysToKeep);
  },

  /**
   * Delete all user data for an M3U
   */
  async deleteAll(username: string, uuid: string): Promise<void> {
    return await window.electron.userData.deleteAll(username, uuid);
  },

  /**
   * Delete all user data for a user
   */
  async deleteAllForUser(username: string): Promise<void> {
    return await window.electron.userData.deleteAllForUser(username);
  },

  /**
   * Clear in-memory cache
   */
  clearCache(username: string, uuid: string): void {
    window.electron.userData.clearCache(username, uuid);
  },
};
