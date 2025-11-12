/**
 * Storage API - Main entry point
 * Provides unified interface for all storage operations
 */

const { getFileSystemAdapter } = require('./fs-adapter.cjs');
const { getM3UManager } = require('./m3u-manager.cjs');
const { getProfileManager } = require('./profile-manager.cjs');
const { getUserDataManager } = require('./user-data-manager.cjs');
const { getDiffCalculator } = require('./diff-calculator.cjs');
const { getStatsCalculator } = require('./stats-calculator.cjs');

class StorageAPI {
  constructor() {
    this.fs = getFileSystemAdapter();
    this.m3u = getM3UManager();
    this.profiles = getProfileManager();
    this.userData = getUserDataManager();
    this.diffCalc = getDiffCalculator();
    this.statsCalc = getStatsCalculator();
    this.initialized = false;
  }

  /**
   * Initialize all storage subsystems
   */
  async init() {
    if (this.initialized) return;

    await this.fs.init();
    this.initialized = true;

    console.log('[Storage] All subsystems initialized');
  }

  /**
   * Close storage (cleanup if needed)
   */
  async close() {
    console.log('[Storage] Closing storage');
    this.userData.clearCache();
  }
}

// Singleton instance
let instance = null;

function getStorageAPI() {
  if (!instance) {
    instance = new StorageAPI();
  }
  return instance;
}

module.exports = {
  StorageAPI,
  getStorageAPI,
  getFileSystemAdapter,
  getM3UManager,
  getProfileManager,
  getUserDataManager,
  getDiffCalculator,
  getStatsCalculator,
};
