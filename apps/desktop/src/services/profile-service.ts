/**
 * Profile Service
 * Wrapper around Electron IPC profile management API
 */

export interface BackendProfile {
  username: string;
  createdAt: number;
  m3uRefs: string[]; // UUIDs
  stickyGroups: string[];
  hiddenGroups: string[];
}

export const profileService = {
  /**
   * Get all profiles
   */
  async getAll(): Promise<BackendProfile[]> {
    return await window.electron.profile.getAll();
  },

  /**
   * Get profile by username
   */
  async get(username: string): Promise<BackendProfile | null> {
    return await window.electron.profile.get(username);
  },

  /**
   * Create new profile
   */
  async create(username: string): Promise<BackendProfile> {
    return await window.electron.profile.create(username);
  },

  /**
   * Delete profile
   */
  async delete(username: string): Promise<void> {
    return await window.electron.profile.delete(username);
  },

  /**
   * Check if profile exists
   */
  async hasProfile(username: string): Promise<boolean> {
    return await window.electron.profile.hasProfile(username);
  },
};
