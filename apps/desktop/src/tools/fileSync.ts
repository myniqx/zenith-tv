import type { StateCreator } from 'zustand';
import { fileSystem } from '@/libs';

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
 * Creates a file-synced state slice for Zustand stores.
 *
 * This utility creates a state slice that automatically syncs with a JSON file.
 * All state keys are derived from the `valueName` parameter.
 *
 * ## Features
 * - **Auto-load**: If `initialFilename` is provided, file is loaded on store creation
 * - **Debounced writes**: Multiple updates are batched to reduce file I/O
 * - **Dynamic file switching**: Change the synced file at runtime with `set${V}File`
 * - **Null filename support**: Set filename to `null` to disable sync (value resets to initial)
 *
 * ## Behavior
 * - `setValue()` updates state and schedules a debounced write to file
 * - `setValue()` does nothing if filename is `null` (no file to sync)
 * - `setFilename(newFile)` flushes pending writes, then loads new file
 * - `setFilename(null)` flushes pending writes, resets value to initial
 *
 * @param initialFilename - File to sync with, or `null` to start without sync
 * @param initial - Default value when file doesn't exist or filename is null
 * @param valueName - Name for the value (determines all derived key names)
 * @param options - Optional configuration for debounce, callbacks
 *
 * @example
 * // Basic usage - syncs with profiles.json
 * const useStore = create<StoreState>((set, get) => ({
 *   ...syncFile<Profile[], 'profiles'>('profiles.json', [], 'profiles')(set, get),
 * }));
 *
 * // Usage in components
 * const { profiles, setProfiles, profilesFile, setProfilesFile } = useStore();
 *
 * // Update value (auto-saves to file)
 * await setProfiles([...profiles, newProfile]);
 *
 * // Update with callback
 * await setProfiles(prev => prev.filter(p => p.id !== id));
 *
 * // Switch to different file
 * await setProfilesFile('backup-profiles.json');
 *
 * // Disable file sync (value resets to initial)
 * await setProfilesFile(null);
 *
 * @example
 * // Start without file sync
 * ...syncFile<Data[], 'data'>(null, [], 'data')(set, get)
 *
 * // Later, enable sync
 * await setDataFile('data.json'); // loads file content into state
 */
export const syncFile = <T = unknown, V extends string = 'value'>(
  initialFilename: string | null,
  initial: T,
  valueName: V = 'value' as V,
  options: FileSyncOptions = {}
) => {
  const {
    debounceMs = 500,
    onLoad,
    onSave,
    onError,
  } = options;

  let debounceTimer: NodeJS.Timeout | null = null;
  let currentFilename: string | null = null;

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const flushPendingWrite = async (get: () => Record<string, unknown>) => {
    if (debounceTimer && currentFilename) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
      try {
        await fileSystem.writeJSON(currentFilename, get()[valueName]);
      } catch (error) {
        console.error(`[FileSync] Failed to flush ${currentFilename}:`, error);
      }
    }
  };

  return (set: (partial: Partial<Record<string, unknown>>) => void, get: () => Record<string, unknown>): FileSyncedState<T, V> => {
    const setterKey = `set${capitalize(valueName)}`;
    const loadingKey = `${valueName}Loading`;
    const errorKey = `${valueName}Error`;
    const fileKey = `${valueName}File`;
    const setFileKey = `set${capitalize(valueName)}File`;

    const state = {
      [valueName]: initial,
      [fileKey]: initialFilename,
      [loadingKey]: false,
      [errorKey]: null,

      [setterKey]: async (next: T | ((prev: T) => T)) => {
        if (!currentFilename) return;

        const currentState = get();
        const oldValue = (currentState[valueName] as T) ?? initial;
        const newValue = typeof next === 'function' ? (next as (prev: T) => T)(oldValue) : next;

        set({ [valueName]: newValue, [errorKey]: null });

        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(async () => {
          try {
            await fileSystem.writeJSON(currentFilename!, newValue);
            onSave?.(newValue);
          } catch (error) {
            const err = error as Error;
            console.error(`[FileSync] Failed to save ${currentFilename}:`, err);
            set({ [errorKey]: err.message });
            onError?.(err);
          }
        }, debounceMs);
      },

      [setFileKey]: async (newFilename: string | null) => {
        if (currentFilename === newFilename) return;

        await flushPendingWrite(get);

        // null → reset to initial, no file sync
        if (!newFilename) {
          currentFilename = null;
          set({ [fileKey]: null, [valueName]: initial, [loadingKey]: false, [errorKey]: null });
          return;
        }

        set({ [loadingKey]: true, [errorKey]: null });

        try {
          currentFilename = newFilename;
          const data = await fileSystem.ensureFile<T>(newFilename, initial);
          set({ [fileKey]: newFilename, [valueName]: data, [loadingKey]: false });
          onLoad?.(data);
        } catch (error) {
          const err = error as Error;
          console.error(`[FileSync] Failed to load ${newFilename}:`, err);
          set({ [fileKey]: newFilename, [valueName]: initial, [loadingKey]: false, [errorKey]: err.message });
          onError?.(err);
        }
      },
    };

    // Auto-load if initialFilename is provided
    if (initialFilename) {
      (state as any)[setFileKey](initialFilename);
    }

    return state as FileSyncedState<T, V>;
  };
};

/**
 * Creates a file-synced slice as a Zustand StateCreator.
 *
 * This is an alternative to `syncFile` for use with Zustand's slice pattern.
 * It returns a StateCreator function instead of requiring manual `(set, get)` passing.
 *
 * @see {@link syncFile} for full documentation on behavior and features
 *
 * @example
 * // Using with Zustand slice pattern
 * const createProfileSlice = createFileSyncSlice<Profile[], 'profiles'>(
 *   'profiles.json',
 *   [],
 *   'profiles'
 * );
 *
 * const useStore = create<StoreState>()((...a) => ({
 *   ...createProfileSlice(...a),
 *   // other slices...
 * }));
 */
export const createFileSyncSlice = <T, V extends string = 'value'>(
  initialFilename: string | null,
  initial: T,
  valueName: V = 'value' as V,
  options?: FileSyncOptions
): StateCreator<FileSyncedState<T, V>, [], [], FileSyncedState<T, V>> => {
  return (set, get) => syncFile(initialFilename, initial, valueName, options)(set as (partial: Partial<Record<string, unknown>>) => void, get as () => Record<string, unknown>) as FileSyncedState<T, V>;
};
