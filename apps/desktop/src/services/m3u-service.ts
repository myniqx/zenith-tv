/**
 * M3U Service
 * Wrapper around Electron IPC M3U management API
 */

export interface M3UInfo {
  uuid: string;
  url: string;
  hasSource: boolean;
  stats?: M3UStats;
}

export interface M3UStats {
  totalItems: number;
  movies: number;
  series: number;
  liveStreams: number;
  lastUpdated: number;
}

export interface M3UUpdateResult {
  diff: {
    added: string[];
    removed: string[];
  };
  stats: M3UStats;
  parsedItems: any[];
}

export const m3uService = {
  /**
   * Add M3U URL to profile
   */
  async addToProfile(username: string, m3uUrl: string): Promise<{ uuid: string; isNew: boolean }> {
    return await window.electron.m3u.addToProfile(username, m3uUrl);
  },

  /**
   * Remove M3U from profile
   */
  async removeFromProfile(username: string, uuid: string): Promise<void> {
    return await window.electron.m3u.removeFromProfile(username, uuid);
  },

  /**
   * Get all M3Us for a profile
   */
  async getProfileM3Us(username: string): Promise<M3UInfo[]> {
    return await window.electron.m3u.getProfileM3Us(username);
  },

  /**
   * Fetch M3U from URL and cache it
   */
  async fetchAndCache(uuid: string, m3uUrl: string): Promise<string> {
    return await window.electron.m3u.fetchAndCache(uuid, m3uUrl);
  },

  /**
   * Update M3U (download new version, calculate diff)
   */
  async update(uuid: string, m3uUrl: string, parseFunction: (content: string) => Promise<any>): Promise<M3UUpdateResult> {
    return await window.electron.m3u.update(uuid, m3uUrl, parseFunction);
  },

  /**
   * Load cached M3U source
   */
  async loadSource(uuid: string): Promise<string> {
    return await window.electron.m3u.loadSource(uuid);
  },

  /**
   * Get recent items (last 30 days)
   */
  async getRecentItems(username: string, daysToKeep?: number): Promise<any[]> {
    return await window.electron.m3u.getRecentItems(username, daysToKeep);
  },

  /**
   * Get outdated M3Us (need sync)
   */
  async getOutdated(username: string, maxAgeHours?: number): Promise<string[]> {
    return await window.electron.m3u.getOutdated(username, maxAgeHours);
  },

  /**
   * Get stats for all M3Us of a profile
   */
  async getStats(username: string): Promise<M3UStats> {
    return await window.electron.m3u.getStats(username);
  },

  /**
   * Listen to fetch progress events
   */
  onFetchProgress(callback: (data: { uuid: string; progress: any }) => void): void {
    window.electron.m3u.onFetchProgress(callback);
  },

  /**
   * Listen to update progress events
   */
  onUpdateProgress(callback: (data: { uuid: string; progress: any }) => void): void {
    window.electron.m3u.onUpdateProgress(callback);
  },
};
