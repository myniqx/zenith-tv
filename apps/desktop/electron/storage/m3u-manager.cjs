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
   * Create or get UUID for M3U URL
   * @param {string} m3uUrl - M3U URL or file:// path
   * @returns {Promise<{uuid: string, isNew: boolean}>}
   */
  async createUUID(m3uUrl) {
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
   * Write UUID data (source, update, stats)
   * @param {string} uuid - UUID
   * @param {Object} data - Data to write
   * @param {string} [data.source] - M3U source content
   * @param {Object} [data.update] - Update tracking data
   * @param {Object} [data.stats] - Statistics data
   */
  async writeUUID(uuid, { source, update, stats }) {
    if (source !== undefined) {
      await this.fs.writeText(this.getSourcePath(uuid), source);
      console.log(`[M3U Manager] Wrote source for ${uuid} (${(source.length / 1024 / 1024).toFixed(2)} MB)`);
    }

    if (!update) update = {}
    if (!update.createdAt) update.createdAt = Date.now();
    await this.fs.writeJSON(this.getUpdatePath(uuid), update);
    console.log(`[M3U Manager] Wrote update data for ${uuid}`);

    if (stats !== undefined) {
      await this.fs.writeJSON(this.getStatsPath(uuid), stats);
      console.log(`[M3U Manager] Wrote stats for ${uuid}`);
    }
  }

  /**
   * Read UUID data (source, update)
   * @param {string} uuid - UUID
   * @returns {Promise<{source: string|null, update: Object|null}>}
   */
  async readUUID(uuid) {
    let source = null;
    let update = null;

    try {
      source = await this.fs.readText(this.getSourcePath(uuid));
    } catch (error) {
      // File doesn't exist
    }

    try {
      update = await this.fs.readJSON(this.getUpdatePath(uuid));
    } catch {
      update = {};
    }

    return { source, update };
  }

  /**
   * Fetch M3U content from URL or file path
   * Does NOT write to storage - use writeUUID after processing
   * @param {string} urlOrPath - M3U URL or file:// path
   * @param {Function} [onProgress] - Progress callback (0-100)
   * @returns {Promise<string>} M3U content
   */
  async fetchUUID(urlOrPath, onProgress) {
    return await this.fetchM3U(urlOrPath, onProgress);
  }

  /**
   * Get cached M3U source (internal use)
   */
  async getSource(uuid) {
    const path = this.getSourcePath(uuid);
    return await this.fs.readText(path);
  }

  /**
   * Save M3U source (internal use)
   */
  async saveSource(uuid, content) {
    const path = this.getSourcePath(uuid);
    await this.fs.writeText(path, content);
    console.log(`[M3U Manager] Saved source for ${uuid} (${(content.length / 1024 / 1024).toFixed(2)} MB)`);
  }

  /**
   * Get update tracking data (internal use)
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
   * Save update tracking data (internal use)
   */
  async saveUpdateData(uuid, data) {
    const path = this.getUpdatePath(uuid);
    await this.fs.writeJSON(path, data);
  }

  /**
   * Fetch M3U from URL with progress callback
   */
  async fetchM3U(url, onProgress) {
    console.log(`[M3U Manager] Fetching M3U from: ${url}`);

    try {
      // Check if it's a local file
      if (url.startsWith('file://')) {
        // Local file - use Node.js fs
        const fs = require('fs').promises;

        // Convert file:// URL to local path
        const filePath = url.replace('file://', '');

        console.log(`[M3U Manager] Reading local file: ${filePath}`);

        // Read file
        const content = await fs.readFile(filePath, 'utf-8');

        // Report progress as 100% since it's instant
        if (onProgress) {
          onProgress(100);
        }

        console.log(`[M3U Manager] Read ${(content.length / 1024 / 1024).toFixed(2)} MB from local file`);

        return content;
      } else {
        // Remote URL - use fetch
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
      }
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
   * Delete UUID completely (map + all files)
   * @param {string} uuid - UUID to delete
   */
  async deleteUUID(uuid) {
    // Delete from map
    const map = await this.loadMap();
    const url = Object.keys(map).find(key => map[key] === uuid);

    if (url) {
      delete map[url];
      await this.saveMap(map);
    }

    // Delete all files
    await this.fs.delete(this.getSourcePath(uuid));
    await this.fs.delete(this.getUpdatePath(uuid));
    await this.fs.delete(this.getStatsPath(uuid));

    console.log(`[M3U Manager] Deleted UUID ${uuid} and all related files`);
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
