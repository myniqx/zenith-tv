import type {
  DialogOpenFileOptions,
  DialogOpenDirectoryOptions,
  DialogSaveFileOptions,
  DialogResult
} from '../types/ipc';

/**
 * Common file filters for dialogs
 */
export const FILE_FILTERS = {
  M3U: [
    { name: 'M3U Playlists', extensions: ['m3u', 'm3u8'] },
    { name: 'All Files', extensions: ['*'] },
  ],
  JSON: [
    { name: 'JSON Files', extensions: ['json'] },
    { name: 'All Files', extensions: ['*'] },
  ],
  TEXT: [
    { name: 'Text Files', extensions: ['txt'] },
    { name: 'All Files', extensions: ['*'] },
  ],
  VIDEO: [
    { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'ts'] },
    { name: 'All Files', extensions: ['*'] },
  ],
  IMAGE: [
    { name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
    { name: 'All Files', extensions: ['*'] },
  ],
  ALL: [{ name: 'All Files', extensions: ['*'] }],
} as const;

/**
 * Type-safe dialog utilities built on Electron IPC
 */
export const dialog = {
  /**
   * Open file picker dialog
   */
  async openFile(options?: DialogOpenFileOptions): Promise<DialogResult> {
    return window.electron.dialog.openFile(options);
  },

  /**
   * Open directory picker dialog
   */
  async openDirectory(options?: DialogOpenDirectoryOptions): Promise<DialogResult> {
    return window.electron.dialog.openDirectory(options);
  },

  /**
   * Open save file dialog
   */
  async saveFile(options?: DialogSaveFileOptions): Promise<DialogResult> {
    return window.electron.dialog.saveFile(options);
  },

  /**
   * Pick M3U playlist file
   */
  async pickM3UFile(defaultPath?: string): Promise<string | null> {
    const result = await this.openFile({
      title: 'Select M3U Playlist',
      defaultPath,
      filters: FILE_FILTERS.M3U,
      properties: ['openFile'],
    });

    return result.canceled ? null : result.filePath || null;
  },

  /**
   * Pick multiple M3U files
   */
  async pickM3UFiles(defaultPath?: string): Promise<string[]> {
    const result = await this.openFile({
      title: 'Select M3U Playlists',
      defaultPath,
      filters: FILE_FILTERS.M3U,
      properties: ['openFile', 'multiSelections'],
    });

    return result.canceled ? [] : result.filePaths || [];
  },

  /**
   * Pick JSON file
   */
  async pickJSONFile(title = 'Select JSON File', defaultPath?: string): Promise<string | null> {
    const result = await this.openFile({
      title,
      defaultPath,
      filters: FILE_FILTERS.JSON,
      properties: ['openFile'],
    });

    return result.canceled ? null : result.filePath || null;
  },

  /**
   * Save JSON file
   */
  async saveJSONFile(
    title = 'Save JSON File',
    defaultPath?: string
  ): Promise<string | null> {
    const result = await this.saveFile({
      title,
      defaultPath,
      buttonLabel: 'Save',
      filters: FILE_FILTERS.JSON,
    });

    return result.canceled ? null : result.filePath || null;
  },

  /**
   * Pick directory for exports/downloads
   */
  async pickExportDirectory(defaultPath?: string): Promise<string | null> {
    const result = await this.openDirectory({
      title: 'Select Export Directory',
      defaultPath,
      buttonLabel: 'Select',
    });

    return result.canceled ? null : result.filePath || null;
  },

  /**
   * Pick video file
   */
  async pickVideoFile(defaultPath?: string): Promise<string | null> {
    const result = await this.openFile({
      title: 'Select Video File',
      defaultPath,
      filters: FILE_FILTERS.VIDEO,
      properties: ['openFile'],
    });

    return result.canceled ? null : result.filePath || null;
  },

  /**
   * Pick image file
   */
  async pickImageFile(defaultPath?: string): Promise<string | null> {
    const result = await this.openFile({
      title: 'Select Image File',
      defaultPath,
      filters: FILE_FILTERS.IMAGE,
      properties: ['openFile'],
    });

    return result.canceled ? null : result.filePath || null;
  },

  /**
   * Generic file picker with custom filters
   */
  async pickFile(
    title: string,
    filters: Array<{ name: string; extensions: string[] }>,
    defaultPath?: string
  ): Promise<string | null> {
    const result = await this.openFile({
      title,
      defaultPath,
      filters,
      properties: ['openFile'],
    });

    return result.canceled ? null : result.filePath || null;
  },

  /**
   * Generic multi-file picker with custom filters
   */
  async pickFiles(
    title: string,
    filters: Array<{ name: string; extensions: string[] }>,
    defaultPath?: string
  ): Promise<string[]> {
    const result = await this.openFile({
      title,
      defaultPath,
      filters,
      properties: ['openFile', 'multiSelections'],
    });

    return result.canceled ? [] : result.filePaths || [];
  },

  /**
   * Generic save file picker with custom filters
   */
  async saveFileAs(
    title: string,
    filters: Array<{ name: string; extensions: string[] }>,
    defaultPath?: string,
    buttonLabel = 'Save'
  ): Promise<string | null> {
    const result = await this.saveFile({
      title,
      defaultPath,
      buttonLabel,
      filters,
    });

    return result.canceled ? null : result.filePath || null;
  },
} as const;
