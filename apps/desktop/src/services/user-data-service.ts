/**
 * User Data Service
 * Wrapper around Electron IPC user data management API
 * Handles favorites, watch progress, hidden items, track preferences
 *
 * Business logic is implemented here in TypeScript.
 * IPC layer only provides simple read/write/delete operations.
 */

export interface UserItemData {
  favorite?: boolean;
  hidden?: boolean;
  watchProgress?: number; // 0-100 percentage
  lastWatchedAt?: number;
  watched?: boolean;
  watchedAt?: number;
  audioTrack?: number;
  subtitleTrack?: number;
}

export interface UserData {
  [itemUrl: string]: UserItemData;
}

export interface UserDataStats {
  totalTracked: number;
  favorites: number;
  hidden: number;
  watched: number;
  inProgress: number;
}

export interface FavoriteItem {
  url: string;
  favorite: boolean;
  sourceUUID: string;
  [key: string]: unknown;
}

export interface RecentlyWatchedItem {
  url: string;
  lastWatchedAt: number;
  watchProgress?: number;
  sourceUUID: string;
  [key: string]: unknown;
}

export const userDataService = {
  /**
   * Get all user data for an M3U
   */
  async get(username: string, uuid: string): Promise<UserData> {
    return await window.electron.userData.readData(username, uuid);
  },

  /**
   * Get user data for a specific item
   */
  async getItem(username: string, uuid: string, itemUrl: string): Promise<UserItemData | null> {
    const userData = await window.electron.userData.readData(username, uuid);
    return userData[itemUrl] || null;
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
    const userData = await window.electron.userData.readData(username, uuid);

    if (!userData[itemUrl]) {
      userData[itemUrl] = {};
    }

    Object.assign(userData[itemUrl], updates);

    await window.electron.userData.writeData(username, uuid, userData);
    return userData[itemUrl];
  },

  /**
   * Delete user data for an item
   */
  async deleteItem(username: string, uuid: string, itemUrl: string): Promise<void> {
    const userData = await window.electron.userData.readData(username, uuid);
    delete userData[itemUrl];
    await window.electron.userData.writeData(username, uuid, userData);
  },

  /**
   * Toggle favorite status
   */
  async toggleFavorite(username: string, uuid: string, itemUrl: string): Promise<boolean> {
    const userData = await window.electron.userData.readData(username, uuid);

    if (!userData[itemUrl]) {
      userData[itemUrl] = {};
    }

    userData[itemUrl].favorite = !userData[itemUrl].favorite;

    await window.electron.userData.writeData(username, uuid, userData);
    return userData[itemUrl].favorite || false;
  },

  /**
   * Toggle hidden status
   */
  async toggleHidden(username: string, uuid: string, itemUrl: string): Promise<boolean> {
    const userData = await window.electron.userData.readData(username, uuid);

    if (!userData[itemUrl]) {
      userData[itemUrl] = {};
    }

    userData[itemUrl].hidden = !userData[itemUrl].hidden;

    await window.electron.userData.writeData(username, uuid, userData);
    return userData[itemUrl].hidden || false;
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
    return await this.updateItem(username, uuid, itemUrl, {
      watchProgress: progress,
      lastWatchedAt: Date.now(),
    });
  },

  /**
   * Mark item as watched (100% progress)
   */
  async markAsWatched(username: string, uuid: string, itemUrl: string): Promise<UserItemData> {
    return await this.updateItem(username, uuid, itemUrl, {
      watched: true,
      watchedAt: Date.now(),
    });
  },

  /**
   * Save preferred audio/subtitle tracks
   */
  async saveTracks(
    username: string,
    uuid: string,
    itemUrl: string,
    audioTrack: number | null,
    subtitleTrack: number | null
  ): Promise<UserItemData> {
    return await this.updateItem(username, uuid, itemUrl, {
      audioTrack: audioTrack ?? undefined,
      subtitleTrack: subtitleTrack ?? undefined,
    });
  },

  /**
   * Get all favorites across multiple M3Us
   */
  async getAllFavorites(username: string, uuids: string[]): Promise<FavoriteItem[]> {
    const allFavorites: FavoriteItem[] = [];

    for (const uuid of uuids) {
      const userData = await window.electron.userData.readData(username, uuid);

      const favorites = Object.entries(userData)
        .filter(([_, data]) => data.favorite)
        .map(([url, data]) => ({
          url,
          ...data,
          sourceUUID: uuid,
        }));

      allFavorites.push(...favorites);
    }

    return allFavorites;
  },

  /**
   * Get all recently watched items
   */
  async getAllRecentlyWatched(username: string, uuids: string[], limit: number = 50): Promise<RecentlyWatchedItem[]> {
    const allRecent: RecentlyWatchedItem[] = [];

    for (const uuid of uuids) {
      const userData = await window.electron.userData.readData(username, uuid);

      const recent = Object.entries(userData)
        .filter(([_, data]) => data.lastWatchedAt)
        .map(([url, data]) => ({
          url,
          lastWatchedAt: data.lastWatchedAt!,
          watchProgress: data.watchProgress,
          sourceUUID: uuid,
          ...data,
        }));

      allRecent.push(...recent);
    }

    // Sort by lastWatchedAt (newest first)
    allRecent.sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);

    return allRecent.slice(0, limit);
  },

  /**
   * Get stats for user data
   */
  async getStats(username: string, uuid: string): Promise<UserDataStats> {
    const userData = await window.electron.userData.readData(username, uuid);

    const stats: UserDataStats = {
      totalTracked: Object.keys(userData).length,
      favorites: 0,
      hidden: 0,
      watched: 0,
      inProgress: 0,
    };

    for (const data of Object.values(userData)) {
      if (data.favorite) stats.favorites++;
      if (data.hidden) stats.hidden++;
      if (data.watched) stats.watched++;
      if (data.watchProgress && data.watchProgress > 0) stats.inProgress++;
    }

    return stats;
  },

  /**
   * Get combined stats across multiple M3Us
   */
  async getCombinedStats(username: string, uuids: string[]): Promise<UserDataStats> {
    const combinedStats: UserDataStats = {
      totalTracked: 0,
      favorites: 0,
      hidden: 0,
      watched: 0,
      inProgress: 0,
    };

    for (const uuid of uuids) {
      const stats = await this.getStats(username, uuid);

      combinedStats.totalTracked += stats.totalTracked;
      combinedStats.favorites += stats.favorites;
      combinedStats.hidden += stats.hidden;
      combinedStats.watched += stats.watched;
      combinedStats.inProgress += stats.inProgress;
    }

    return combinedStats;
  },

  /**
   * Clear old watch history (older than X days)
   */
  async clearOldHistory(username: string, uuid: string, daysToKeep: number = 30): Promise<number> {
    const userData = await window.electron.userData.readData(username, uuid);
    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

    let cleaned = 0;

    for (const [url, data] of Object.entries(userData)) {
      // Keep if: favorite, hidden, or recently watched
      const keep =
        data.favorite ||
        data.hidden ||
        (data.lastWatchedAt && data.lastWatchedAt > cutoff);

      if (!keep) {
        delete userData[url];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await window.electron.userData.writeData(username, uuid, userData);
    }

    return cleaned;
  },

  /**
   * Delete all user data for an M3U
   */
  async deleteAll(username: string, uuid: string): Promise<void> {
    await window.electron.userData.deleteData(username, uuid);
  },

  /**
   * Delete all user data for a user (all M3U sources)
   */
  async deleteAllForUser(username: string): Promise<void> {
    // This would require getting all UUIDs for the user
    // For now, we'll just note that this needs to be handled differently
    // or we need to add a separate IPC handler for this specific case
    console.warn('deleteAllForUser is not implemented in the new API structure');
    throw new Error('deleteAllForUser requires backend implementation');
  },

  /**
   * Clear in-memory cache
   * Note: This is handled automatically by the backend now
   */
  clearCache(_username: string, _uuid: string): void {
    // Cache is handled by the backend, no-op in new implementation
    console.log('Cache clearing is handled automatically by the backend');
  },
};
