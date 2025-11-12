const { getFileSystemAdapter } = require('./fs-adapter.cjs');

/**
 * User Data Manager
 * Manages per-user, per-M3U preferences (favorite, hide, watched, progress)
 *
 * Structure: user-data/{username}/{uuid}.json
 * Content: { "itemUrl": { favorite, hidden, watchProgress, lastWatchedAt, ... } }
 */
class UserDataManager {
  constructor() {
    this.fs = getFileSystemAdapter();
    this.cache = new Map(); // Cache key: "username/uuid"
  }

  /**
   * Get user data file path
   */
  getUserDataPath(username, uuid) {
    return `user-data/${username}/${uuid}.json`;
  }

  /**
   * Get cache key
   */
  getCacheKey(username, uuid) {
    return `${username}/${uuid}`;
  }

  /**
   * Load user data for username + M3U UUID
   */
  async loadUserData(username, uuid) {
    const cacheKey = this.getCacheKey(username, uuid);

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const path = this.getUserDataPath(username, uuid);
    const data = await this.fs.readJSON(path);

    const userData = data || {};
    this.cache.set(cacheKey, userData);

    return userData;
  }

  /**
   * Save user data
   */
  async saveUserData(username, uuid, userData) {
    const path = this.getUserDataPath(username, uuid);
    await this.fs.writeJSON(path, userData);

    const cacheKey = this.getCacheKey(username, uuid);
    this.cache.set(cacheKey, userData);
  }

  /**
   * Get data for specific item
   */
  async getItemData(username, uuid, itemUrl) {
    const userData = await this.loadUserData(username, uuid);
    return userData[itemUrl] || null;
  }

  /**
   * Update data for specific item
   */
  async updateItemData(username, uuid, itemUrl, updates) {
    const userData = await this.loadUserData(username, uuid);

    if (!userData[itemUrl]) {
      userData[itemUrl] = {};
    }

    Object.assign(userData[itemUrl], updates);

    await this.saveUserData(username, uuid, userData);
    return userData[itemUrl];
  }

  /**
   * Delete data for specific item
   */
  async deleteItemData(username, uuid, itemUrl) {
    const userData = await this.loadUserData(username, uuid);
    delete userData[itemUrl];
    await this.saveUserData(username, uuid, userData);
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(username, uuid, itemUrl) {
    const userData = await this.loadUserData(username, uuid);

    if (!userData[itemUrl]) {
      userData[itemUrl] = {};
    }

    userData[itemUrl].favorite = !userData[itemUrl].favorite;

    await this.saveUserData(username, uuid, userData);
    return userData[itemUrl].favorite;
  }

  /**
   * Toggle hidden status
   */
  async toggleHidden(username, uuid, itemUrl) {
    const userData = await this.loadUserData(username, uuid);

    if (!userData[itemUrl]) {
      userData[itemUrl] = {};
    }

    userData[itemUrl].hidden = !userData[itemUrl].hidden;

    await this.saveUserData(username, uuid, userData);
    return userData[itemUrl].hidden;
  }

  /**
   * Update watch progress
   */
  async updateWatchProgress(username, uuid, itemUrl, progress) {
    return await this.updateItemData(username, uuid, itemUrl, {
      watchProgress: progress,
      lastWatchedAt: Date.now(),
    });
  }

  /**
   * Mark item as watched
   */
  async markAsWatched(username, uuid, itemUrl) {
    return await this.updateItemData(username, uuid, itemUrl, {
      watched: true,
      watchedAt: Date.now(),
    });
  }

  /**
   * Save preferred tracks (audio/subtitle)
   */
  async savePreferredTracks(username, uuid, itemUrl, audioTrack, subtitleTrack) {
    return await this.updateItemData(username, uuid, itemUrl, {
      audioTrack,
      subtitleTrack,
    });
  }

  /**
   * Get all favorites for username across all M3U sources
   */
  async getAllFavorites(username, uuids) {
    const allFavorites = [];

    for (const uuid of uuids) {
      const userData = await this.loadUserData(username, uuid);

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
  }

  /**
   * Get recently watched items for username across all M3U sources
   */
  async getAllRecentlyWatched(username, uuids, limit = 50) {
    const allRecent = [];

    for (const uuid of uuids) {
      const userData = await this.loadUserData(username, uuid);

      const recent = Object.entries(userData)
        .filter(([_, data]) => data.lastWatchedAt)
        .map(([url, data]) => ({
          url,
          ...data,
          sourceUUID: uuid,
        }));

      allRecent.push(...recent);
    }

    // Sort by lastWatchedAt (newest first)
    allRecent.sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);

    return allRecent.slice(0, limit);
  }

  /**
   * Get statistics for username + M3U
   */
  async getStats(username, uuid) {
    const userData = await this.loadUserData(username, uuid);

    const stats = {
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
  }

  /**
   * Get combined statistics for username across all M3U sources
   */
  async getCombinedStats(username, uuids) {
    const combinedStats = {
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
  }

  /**
   * Clear old watch history (older than X days)
   */
  async clearOldHistory(username, uuid, daysToKeep = 30) {
    const userData = await this.loadUserData(username, uuid);
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
      await this.saveUserData(username, uuid, userData);
      console.log(`[UserData] Cleaned ${cleaned} old entries for ${username}/${uuid}`);
    }

    return cleaned;
  }

  /**
   * Delete all user data for username + M3U
   */
  async deleteUserData(username, uuid) {
    const path = this.getUserDataPath(username, uuid);
    await this.fs.delete(path);

    const cacheKey = this.getCacheKey(username, uuid);
    this.cache.delete(cacheKey);

    console.log(`[UserData] Deleted data for ${username}/${uuid}`);
  }

  /**
   * Delete all user data for username (all M3U sources)
   */
  async deleteAllUserData(username) {
    // Delete directory
    const files = await this.fs.listFiles(`user-data/${username}`);

    for (const file of files) {
      await this.fs.delete(`user-data/${username}/${file}`);
    }

    // Clear cache
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${username}/`)) {
        this.cache.delete(key);
      }
    }

    console.log(`[UserData] Deleted all data for ${username}`);
  }

  /**
   * Clear cache
   */
  clearCache(username, uuid) {
    if (username && uuid) {
      const cacheKey = this.getCacheKey(username, uuid);
      this.cache.delete(cacheKey);
    } else if (username) {
      // Clear all cache for username
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${username}/`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }
}

// Singleton instance
let instance = null;

function getUserDataManager() {
  if (!instance) {
    instance = new UserDataManager();
  }
  return instance;
}

module.exports = { UserDataManager, getUserDataManager };
