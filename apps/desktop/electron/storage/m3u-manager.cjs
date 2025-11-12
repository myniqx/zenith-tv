const { getFileSystemAdapter } = require('./fs-adapter.cjs');
const crypto = require('crypto');

/**
 * M3U Manager
 * Manages shared M3U cache with UUID mapping
 * Multiple users can reference the same M3U source (bandwidth optimization)
 */
class M3UManager {
  constructor() {
    this.fs = getFileSystemAdapter();
    this.mapCache = null; // In-memory cache of map.json
  }

  /**
   * Load URL → UUID mapping
   */
  async loadMap() {
    if (this.mapCache) {
      return this.mapCache;
    }

    const map = await this.fs.readJSON('m3u/map.json');
    this.mapCache = map || {};
    return this.mapCache;
  }

  /**
   * Save URL → UUID mapping
   */
  async saveMap(map) {
    await this.fs.writeJSON('m3u/map.json', map);
    this.mapCache = map;
  }

  /**
   * Get UUID for M3U URL (or create new)
   */
  async getOrCreateUUID(m3uUrl) {
    const map = await this.loadMap();

    if (map[m3uUrl]) {
      return { uuid: map[m3uUrl], isNew: false };
    }

    // Create new UUID
    const uuid = crypto.randomUUID();
    map[m3uUrl] = uuid;
    await this.saveMap(map);

    // Create directory structure
    await this.fs.writeText(`m3u/${uuid}/.keep`, '');

    console.log(`[M3U Manager] Created new UUID: ${uuid} for ${m3uUrl}`);

    return { uuid, isNew: true };
  }

  /**
   * Get M3U source file path
   */
  getSourcePath(uuid) {
    return `m3u/${uuid}/source.m3u`;
  }

  /**
   * Get update tracking file path
   */
  getUpdatePath(uuid) {
    return `m3u/${uuid}/update.json`;
  }

  /**
   * Get statistics file path
   */
  getStatsPath(uuid) {
    return `m3u/${uuid}/stats.json`;
  }

  /**
   * Check if M3U source exists
   */
  async hasSource(uuid) {
    return await this.fs.exists(this.getSourcePath(uuid));
  }

  /**
   * Get cached M3U source
   */
  async getSource(uuid) {
    const path = this.getSourcePath(uuid);
    return await this.fs.readText(path);
  }

  /**
   * Save M3U source
   */
  async saveSource(uuid, content) {
    const path = this.getSourcePath(uuid);
    await this.fs.writeText(path, content);
    console.log(`[M3U Manager] Saved source for ${uuid} (${(content.length / 1024 / 1024).toFixed(2)} MB)`);
  }

  /**
   * Get update tracking data
   */
  async getUpdateData(uuid) {
    const path = this.getUpdatePath(uuid);
    const data = await this.fs.readJSON(path);

    return data || {
      lastUpdated: null,
      items: [], // { url, title, group, addedAt }
    };
  }

  /**
   * Save update tracking data
   */
  async saveUpdateData(uuid, data) {
    const path = this.getUpdatePath(uuid);
    await this.fs.writeJSON(path, data);
  }

  /**
   * Get recent items (last 30 days)
   */
  async getRecentItems(uuid, daysToKeep = 30) {
    const updateData = await this.getUpdateData(uuid);
    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

    return updateData.items.filter(item => item.addedAt > cutoff);
  }

  /**
   * Add new items to update tracking
   */
  async addNewItems(uuid, newItems) {
    const updateData = await this.getUpdateData(uuid);

    const now = Date.now();
    const itemsWithTimestamp = newItems.map(item => ({
      ...item,
      addedAt: now,
    }));

    updateData.items.push(...itemsWithTimestamp);
    updateData.lastUpdated = now;

    // Clean old items (30 days)
    const cutoff = now - 30 * 24 * 60 * 60 * 1000;
    updateData.items = updateData.items.filter(item => item.addedAt > cutoff);

    await this.saveUpdateData(uuid, updateData);

    console.log(`[M3U Manager] Added ${newItems.length} new items to ${uuid}`);
    return itemsWithTimestamp;
  }

  /**
   * Get statistics
   */
  async getStats(uuid) {
    const path = this.getStatsPath(uuid);
    const stats = await this.fs.readJSON(path);

    return stats || {
      lastUpdated: null,
      totalItems: 0,
      movies: 0,
      series: 0,
      liveStreams: 0,
      seasons: 0,
      episodes: 0,
      groups: {},
      categories: {},
    };
  }

  /**
   * Save statistics
   */
  async saveStats(uuid, stats) {
    const path = this.getStatsPath(uuid);
    stats.lastUpdated = Date.now();
    await this.fs.writeJSON(path, stats);
  }

  /**
   * Fetch M3U from URL with progress callback
   */
  async fetchM3U(url, onProgress) {
    console.log(`[M3U Manager] Fetching M3U from: ${url}`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      let loaded = 0;
      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        loaded += value.length;

        if (onProgress && total > 0) {
          const progress = (loaded / total) * 100;
          onProgress(progress);
        }
      }

      // Combine chunks
      const allChunks = new Uint8Array(loaded);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }

      const content = new TextDecoder('utf-8').decode(allChunks);

      console.log(`[M3U Manager] Downloaded ${(loaded / 1024 / 1024).toFixed(2)} MB`);

      return content;
    } catch (error) {
      console.error('[M3U Manager] Fetch error:', error);
      throw new Error(`Failed to fetch M3U: ${error.message}`);
    }
  }

  /**
   * Get all UUIDs
   */
  async getAllUUIDs() {
    const map = await this.loadMap();
    return Object.values(map);
  }

  /**
   * Get URL for UUID
   */
  async getURLForUUID(uuid) {
    const map = await this.loadMap();
    return Object.keys(map).find(url => map[url] === uuid) || null;
  }

  /**
   * Delete M3U source and related data
   */
  async deleteSource(uuid) {
    // Delete source file
    await this.fs.delete(this.getSourcePath(uuid));

    // Delete update data
    await this.fs.delete(this.getUpdatePath(uuid));

    // Delete stats
    await this.fs.delete(this.getStatsPath(uuid));

    console.log(`[M3U Manager] Deleted source ${uuid}`);
  }

  /**
   * Remove UUID from map
   */
  async removeFromMap(m3uUrl) {
    const map = await this.loadMap();
    const uuid = map[m3uUrl];

    if (uuid) {
      delete map[m3uUrl];
      await this.saveMap(map);
      return uuid;
    }

    return null;
  }
}

// Singleton instance
let instance = null;

function getM3UManager() {
  if (!instance) {
    instance = new M3UManager();
  }
  return instance;
}

module.exports = { M3UManager, getM3UManager };
