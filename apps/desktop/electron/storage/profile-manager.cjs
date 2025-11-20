const { getFileSystemAdapter } = require('./fs-adapter.cjs');
const { getM3UManager } = require('./m3u-manager.cjs');
const { getDiffCalculator } = require('./diff-calculator.cjs');
const { getStatsCalculator } = require('./stats-calculator.cjs');

/**
 * Profile Manager
 * Manages username-based profiles with M3U references (UUIDs)
 */
class ProfileManager {
  constructor() {
    this.fs = getFileSystemAdapter();
    this.m3uManager = getM3UManager();
    this.diffCalc = getDiffCalculator();
    this.statsCalc = getStatsCalculator();
  }

  /**
   * Create a new profile
   */
  async createProfile(username) {
    const profile = {
      username,
      createdAt: Date.now(),
      m3uRefs: [], // Array of UUIDs
      stickyGroups: [], // Sticky group names
      hiddenGroups: [], // Hidden group names
    };

    await this.fs.writeJSON(`profiles/${username}.json`, profile);
    console.log(`[Profile Manager] Created profile: ${username}`);
    return profile;
  }

  /**
   * Get all profiles
   */
  async getAllProfiles() {
    const files = await this.fs.listFiles('profiles');
    const profiles = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const profile = await this.fs.readJSON(`profiles/${file}`);
        if (profile) {
          profiles.push(profile);
        }
      }
    }

    return profiles.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get profile by username
   */
  async getProfile(username) {
    return await this.fs.readJSON(`profiles/${username}.json`);
  }

  /**
   * Check if profile exists
   */
  async hasProfile(username) {
    return await this.fs.exists(`profiles/${username}.json`);
  }

  /**
   * Delete profile (does NOT delete shared M3U cache)
   */
  async deleteProfile(username) {
    await this.fs.delete(`profiles/${username}.json`);
    console.log(`[Profile Manager] Deleted profile: ${username}`);
  }

  /**
   * Add M3U URL to profile
   * Returns { uuid, isNew, source }
   */
  async addM3UToProfile(username, m3uUrl) {
    const profile = await this.getProfile(username);
    if (!profile) {
      throw new Error(`Profile not found: ${username}`);
    }

    // Get or create UUID for this M3U URL
    const { uuid, isNew } = await this.m3uManager.getOrCreateUUID(m3uUrl);

    // Add UUID to profile if not already there
    if (!profile.m3uRefs.includes(uuid)) {
      profile.m3uRefs.push(uuid);
      await this.fs.writeJSON(`profiles/${username}.json`, profile);
    }

    // Check if we need to download
    const hasSource = await this.m3uManager.hasSource(uuid);

    console.log(`[Profile Manager] Added M3U ${uuid} to ${username} (new: ${isNew}, cached: ${hasSource})`);

    return { uuid, isNew, hasCache: hasSource };
  }

  /**
   * Remove M3U from profile
   */
  async removeM3UFromProfile(username, uuid) {
    const profile = await this.getProfile(username);
    if (!profile) {
      throw new Error(`Profile not found: ${username}`);
    }

    profile.m3uRefs = profile.m3uRefs.filter(ref => ref !== uuid);
    await this.fs.writeJSON(`profiles/${username}.json`, profile);

    console.log(`[Profile Manager] Removed M3U ${uuid} from ${username}`);
  }

  /**
   * Fetch and cache M3U (initial download)
   */
  async fetchAndCacheM3U(uuid, m3uUrl, onProgress) {
    console.log(`[Profile Manager] Fetching M3U ${uuid} from ${m3uUrl}`);

    // Download M3U
    const content = await this.m3uManager.fetchM3U(m3uUrl, onProgress);

    // Save to cache
    await this.m3uManager.saveSource(uuid, content);

    return content;
  }

  /**
   * Update M3U (download new version, calculate diff, update tracking)
   */
  async updateM3U(uuid, m3uUrl, parseFunction, onProgress) {
    console.log(`[Profile Manager] Updating M3U ${uuid}`);

    // Get old content
    const oldContent = await this.m3uManager.getSource(uuid);

    // Download new content
    const newContent = await this.m3uManager.fetchM3U(m3uUrl, onProgress);

    // Calculate diff
    const diff = this.diffCalc.calculateDiff(oldContent, newContent);

    // Parse new content with Rust parser (returns parsed items array)
    const parsedItems = await parseFunction(newContent);

    // Calculate new statistics
    const stats = this.statsCalc.calculateStats(parsedItems);
    await this.m3uManager.saveStats(uuid, stats);

    // Add new items to update tracking
    if (diff.added.length > 0) {
      await this.m3uManager.addNewItems(uuid, diff.added);
    }

    // Save new source
    await this.m3uManager.saveSource(uuid, newContent);

    console.log(`[Profile Manager] Updated M3U ${uuid}: +${diff.added.length} -${diff.removed.length}`);

    return {
      diff,
      stats,
      parsedItems,
    };
  }

  /**
   * Get all M3U sources for a profile
   */
  async getProfileM3Us(username) {
    const profile = await this.getProfile(username);
    if (!profile) {
      throw new Error(`Profile not found: ${username}`);
    }

    const m3us = [];

    for (const uuid of profile.m3uRefs) {
      const url = await this.m3uManager.getURLForUUID(uuid);
      const hasSource = await this.m3uManager.hasSource(uuid);
      const stats = await this.m3uManager.getStats(uuid);

      m3us.push({
        uuid,
        url,
        hasSource,
        stats,
      });
    }

    return m3us;
  }

  /**
   * Get recent items for profile (last 30 days)
   */
  async getRecentItems(username, daysToKeep = 30) {
    const profile = await this.getProfile(username);
    if (!profile) {
      throw new Error(`Profile not found: ${username}`);
    }

    const allRecent = [];

    for (const uuid of profile.m3uRefs) {
      const recentItems = await this.m3uManager.getRecentItems(uuid, daysToKeep);

      // Add UUID to each item for reference
      const itemsWithUUID = recentItems.map(item => ({
        ...item,
        sourceUUID: uuid,
      }));

      allRecent.push(...itemsWithUUID);
    }

    // Sort by addedAt (newest first)
    allRecent.sort((a, b) => b.addedAt - a.addedAt);

    return allRecent;
  }

  /**
   * Get combined statistics for profile
   */
  async getProfileStats(username) {
    const profile = await this.getProfile(username);
    if (!profile) {
      throw new Error(`Profile not found: ${username}`);
    }

    const combinedStats = {
      totalItems: 0,
      movies: 0,
      series: 0,
      liveStreams: 0,
      seasons: 0,
      episodes: 0,
      groups: {},
      categories: {},
      sources: profile.m3uRefs.length,
    };

    for (const uuid of profile.m3uRefs) {
      const stats = await this.m3uManager.getStats(uuid);

      combinedStats.totalItems += stats.totalItems || 0;
      combinedStats.movies += stats.movies || 0;
      combinedStats.series += stats.series || 0;
      combinedStats.liveStreams += stats.liveStreams || 0;
      combinedStats.seasons += stats.seasons || 0;
      combinedStats.episodes += stats.episodes || 0;

      // Merge groups
      for (const [group, count] of Object.entries(stats.groups || {})) {
        combinedStats.groups[group] = (combinedStats.groups[group] || 0) + count;
      }

      // Merge categories
      for (const [category, count] of Object.entries(stats.categories || {})) {
        combinedStats.categories[category] = (combinedStats.categories[category] || 0) + count;
      }
    }

    return combinedStats;
  }

  /**
   * Load M3U source for profile (from cache)
   */
  async loadM3USource(uuid) {
    return await this.m3uManager.getSource(uuid);
  }

  /**
   * Check if any M3U needs update (for auto-sync)
   */
  async getOutdatedM3Us(username, maxAgeHours = 24) {
    const profile = await this.getProfile(username);
    if (!profile) {
      throw new Error(`Profile not found: ${username}`);
    }

    const outdated = [];
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    for (const uuid of profile.m3uRefs) {
      const stats = await this.m3uManager.getStats(uuid);

      if (!stats.lastUpdated || (Date.now() - stats.lastUpdated) > maxAge) {
        const url = await this.m3uManager.getURLForUUID(uuid);
        outdated.push({ uuid, url, lastUpdated: stats.lastUpdated });
      }
    }

    return outdated;
  }

  /**
   * Save M3U statistics from parsed items
   * @param {string} uuid - M3U UUID
   * @param {Array} parsedItems - Parsed items from Rust parser (frontend)
   */
  async saveM3UStats(uuid, parsedItems) {
    console.log(`[Profile Manager] Saving stats for ${uuid} (${parsedItems.length} items)`);

    // Calculate statistics using stats calculator
    const stats = this.statsCalc.calculateStats(parsedItems);

    // Save to M3U manager
    await this.m3uManager.saveStats(uuid, stats);

    console.log(`[Profile Manager] Stats saved: ${stats.totalItems} items (${stats.movies} movies, ${stats.series} series, ${stats.liveStreams} live)`);

    return stats;
  }

}

// Singleton instance
let instance = null;

function getProfileManager() {
  if (!instance) {
    instance = new ProfileManager();
  }
  return instance;
}

module.exports = { ProfileManager, getProfileManager };
