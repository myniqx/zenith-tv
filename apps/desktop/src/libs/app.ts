/**
 * Type-safe app utilities built on Electron IPC
 */
export const app = {
  /**
   * Get user data directory path
   */
  async getUserDataPath(): Promise<string> {
    return window.electron.app.getPath('userData');
  },

  /**
   * Get app data directory path
   */
  async getAppDataPath(): Promise<string> {
    return window.electron.app.getPath('appData');
  },

  /**
   * Get temp directory path
   */
  async getTempPath(): Promise<string> {
    return window.electron.app.getPath('temp');
  },

  /**
   * Get home directory path
   */
  async getHomePath(): Promise<string> {
    return window.electron.app.getPath('home');
  },

  /**
   * Get any system path
   */
  async getPath(name: 'userData' | 'appData' | 'temp' | 'home'): Promise<string> {
    return window.electron.app.getPath(name);
  },
} as const;
