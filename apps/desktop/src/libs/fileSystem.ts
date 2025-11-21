import type {
  FileReadOptions,
  FileWriteOptions,
  ReadDirOptions,
  FileStats,
  IPCError
} from '../types/ipc';

/**
 * Type-safe file system utilities built on Electron IPC
 */
export const fileSystem = {
  /**
   * Read file content as string
   */
  async readFile(path: string, options?: FileReadOptions): Promise<string> {
    return window.electron.fs.readFile(path, options);
  },

  /**
   * Read and parse JSON file
   */
  async readJSON<T = unknown>(path: string): Promise<T> {
    const content = await window.electron.fs.readFile(path);
    return JSON.parse(content) as T;
  },

  /**
   * Write string content to file
   */
  async writeFile(path: string, content: string, options?: FileWriteOptions): Promise<void> {
    return window.electron.fs.writeFile(path, content, options);
  },

  /**
   * Write JSON data to file (pretty-printed)
   * In development mode, logs changed keys with old -> new values
   */
  async writeJSON<T>(path: string, data: T, options?: FileWriteOptions): Promise<void> {
    // Development-only diff logging helpers
    const isDev = import.meta.env.DEV;

    const formatValue = (value: unknown): string => {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (typeof value === 'string') return `"${value.length > 50 ? value.slice(0, 50) + '...' : value}"`;
      if (typeof value === 'object') {
        if (Array.isArray(value)) return `Array(${value.length})`;
        return `Object(${Object.keys(value).length} keys)`;
      }
      return String(value);
    };

    const findDiffs = (
      oldObj: unknown,
      newObj: unknown,
      keyPath = ''
    ): Array<{ key: string; oldVal: unknown; newVal: unknown }> => {
      const diffs: Array<{ key: string; oldVal: unknown; newVal: unknown }> = [];

      if (oldObj === newObj) return diffs;

      if (
        typeof oldObj !== 'object' ||
        typeof newObj !== 'object' ||
        oldObj === null ||
        newObj === null
      ) {
        if (oldObj !== newObj) {
          diffs.push({ key: keyPath || 'root', oldVal: oldObj, newVal: newObj });
        }
        return diffs;
      }

      const oldRecord = oldObj as Record<string, unknown>;
      const newRecord = newObj as Record<string, unknown>;
      const allKeys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);

      for (const key of allKeys) {
        const fullKey = keyPath ? `${keyPath}.${key}` : key;
        const oldVal = oldRecord[key];
        const newVal = newRecord[key];

        if (!(key in oldRecord)) {
          diffs.push({ key: fullKey, oldVal: undefined, newVal });
        } else if (!(key in newRecord)) {
          diffs.push({ key: fullKey, oldVal, newVal: undefined });
        } else if (typeof oldVal === 'object' && typeof newVal === 'object' && oldVal !== null && newVal !== null) {
          if (Array.isArray(oldVal) && Array.isArray(newVal)) {
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
              diffs.push({ key: fullKey, oldVal, newVal });
            }
          } else if (!Array.isArray(oldVal) && !Array.isArray(newVal)) {
            diffs.push(...findDiffs(oldVal, newVal, fullKey));
          } else {
            diffs.push({ key: fullKey, oldVal, newVal });
          }
        } else if (oldVal !== newVal) {
          diffs.push({ key: fullKey, oldVal, newVal });
        }
      }

      return diffs;
    };

    if (isDev) {
      try {
        const exists = await window.electron.fs.exists(path);
        if (exists) {
          const oldContent = await window.electron.fs.readFile(path);
          const oldData = JSON.parse(oldContent);
          const diffs = findDiffs(oldData, data);

          if (diffs.length > 0) {
            const fileName = path.split(/[/\\]/).pop() || path;
            console.group(`[FileSystem] writeJSON: ${fileName}`);
            for (const { key, oldVal, newVal } of diffs) {
              console.log(`  ${key}: ${formatValue(oldVal)} -> ${formatValue(newVal)}`);
            }
            console.groupEnd();
          }
        }
      } catch {
        // Ignore errors in dev logging
      }
    }

    const content = JSON.stringify(data, null, 2);
    return window.electron.fs.writeFile(path, content, options);
  },

  /**
   * Read directory contents
   */
  async readDir(path: string, options?: ReadDirOptions): Promise<string[]> {
    return window.electron.fs.readDir(path, options);
  },

  /**
   * Create directory (recursive by default)
   */
  async mkdir(path: string, recursive = true): Promise<void> {
    return window.electron.fs.mkdir(path, recursive);
  },

  /**
   * Delete file or directory
   */
  async delete(path: string): Promise<void> {
    return window.electron.fs.delete(path);
  },

  /**
   * Move/rename file or directory
   */
  async move(oldPath: string, newPath: string): Promise<void> {
    return window.electron.fs.move(oldPath, newPath);
  },

  /**
   * Copy file to destination
   */
  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    return window.electron.fs.copyFile(sourcePath, destPath);
  },

  /**
   * Check if file or directory exists
   */
  async exists(path: string): Promise<boolean> {
    return window.electron.fs.exists(path);
  },

  /**
   * Get file/directory statistics
   */
  async stats(path: string): Promise<FileStats> {
    return window.electron.fs.stats(path);
  },

  /**
   * Watch file or directory for changes
   */
  async watch(
    path: string,
    callback: (event: string, filename: string) => void
  ): Promise<() => void> {
    return window.electron.fs.watch(path, callback);
  },

  /**
   * Read JSON file with fallback to default value if not exists
   */
  async readJSONOrDefault<T>(path: string, defaultValue: T): Promise<T> {
    try {
      const exists = await window.electron.fs.exists(path);
      if (!exists) {
        return defaultValue;
      }
      const content = await window.electron.fs.readFile(path);
      return JSON.parse(content) as T;
    } catch (error) {
      console.warn(`[FileSystem] Failed to read ${path}, using default:`, error);
      return defaultValue;
    }
  },

  /**
   * Ensure file exists, create with default data if not
   */
  async ensureFile<T>(path: string, defaultData: T): Promise<T> {
    try {
      const exists = await window.electron.fs.exists(path);
      if (!exists) {
        await this.writeJSON(path, defaultData);
        return defaultData;
      }
      return await this.readJSON<T>(path);
    } catch (error) {
      console.warn(`[FileSystem] Failed to ensure ${path}, using default:`, error);
      return defaultData;
    }
  },

  /**
   * Update JSON file with partial data (merge)
   */
  async updateJSON<T extends Record<string, unknown>>(
    path: string,
    updater: (data: T) => T | Partial<T>
  ): Promise<T> {
    const current = await this.readJSON<T>(path);
    const updated = updater(current);
    const merged = { ...current, ...updated } as T;
    await this.writeJSON(path, merged);
    return merged;
  },

  /**
   * Check if path is a file
   */
  async isFile(path: string): Promise<boolean> {
    try {
      const stats = await window.electron.fs.stats(path);
      return stats.isFile;
    } catch {
      return false;
    }
  },

  /**
   * Check if path is a directory
   */
  async isDirectory(path: string): Promise<boolean> {
    try {
      const stats = await window.electron.fs.stats(path);
      return stats.isDirectory;
    } catch {
      return false;
    }
  },

  /**
   * Get file size in bytes
   */
  async getSize(path: string): Promise<number> {
    const stats = await window.electron.fs.stats(path);
    return stats.size;
  },

  /**
   * Get file modification time
   */
  async getModifiedTime(path: string): Promise<Date> {
    const stats = await window.electron.fs.stats(path);
    return stats.modified;
  },

  /**
   * Delete file if exists (no error if not exists)
   */
  async deleteIfExists(path: string): Promise<boolean> {
    try {
      const exists = await window.electron.fs.exists(path);
      if (exists) {
        await window.electron.fs.delete(path);
        return true;
      }
      return false;
    } catch (error) {
      console.warn(`[FileSystem] Failed to delete ${path}:`, error);
      return false;
    }
  },
} as const;

/**
 * Type-safe error handler for file operations
 */
export function handleFileError(error: unknown, fallback?: string): IPCError {
  if (error instanceof Error && 'code' in error) {
    return error as IPCError;
  }
  return {
    name: 'IPCError',
    message: fallback || 'Unknown file system error',
    code: 'UNKNOWN',
    details: error,
  } as IPCError;
}
