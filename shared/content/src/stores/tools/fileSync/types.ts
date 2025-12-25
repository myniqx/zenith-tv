/**
 * File-synced state structure for Zustand stores.
 *
 * All state keys are automatically derived from the value name (V):
 *
 * | Key Pattern              | Type                                    | Description                          |
 * |--------------------------|-----------------------------------------|--------------------------------------|
 * | `V`                      | `T`                                     | The synced value                     |
 * | `set${Capitalize<V>}`    | `(next: T | (prev: T) => T) => Promise` | Update value and save to file        |
 * | `${V}File`               | `string | null`                         | Current filename (null = no sync)    |
 * | `set${Capitalize<V>}File`| `(filename: string | null) => Promise`  | Switch file or disable sync          |
 * | `${V}Loading`            | `boolean`                               | Loading state during file operations |
 * | `${V}Error`              | `string | null`                         | Last error message                   |
 *
 * @example
 * // For valueName = 'profiles', you get:
 * // profiles, setProfiles, profilesFile, setProfilesFile, profilesLoading, profilesError
 */
export type FileSyncedState<T, V extends string> = {
  [K in V]: T;
} & {
  [K in `set${Capitalize<V>}`]: (next: T | ((prev: T) => T)) => Promise<void>;
} & {
  [K in `${V}File`]: string | null;
} & {
  [K in `set${Capitalize<V>}File`]: (newFilename: string | null) => Promise<void>;
} & {
  [K in `${V}Loading`]: boolean;
} & {
  [K in `${V}Error`]: string | null;
};

/**
 * Options for file sync behavior.
 */
export interface FileSyncOptions {
  /**
   * Debounce delay for file writes in milliseconds.
   * Multiple rapid updates will be batched into a single write.
   * @default 500
   */
  debounceMs?: number;

  /**
   * Called after data is successfully loaded from file.
   */
  onLoad?: <T>(data: T) => void;

  /**
   * Called after data is successfully saved to file.
   */
  onSave?: <T>(data: T) => void;

  /**
   * Called when a file operation fails.
   */
  onError?: (error: Error) => void;
}

/**
 * File system adapter interface for cross-platform compatibility
 */
export interface FileSystemAdapter {
  writeJSON<T>(path: string, data: T): Promise<void>;
  ensureFile<T>(path: string, defaultData: T): Promise<T>;
}
