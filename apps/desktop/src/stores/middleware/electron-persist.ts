import { StateCreator, StoreApi } from 'zustand';

/**
 * Storage adapter for Electron IPC
 */
export interface ElectronStorageAdapter<T> {
  read: () => Promise<T | null>;
  write: (data: T) => Promise<void>;
  delete: () => Promise<void>;
}

/**
 * Options for electron persist middleware
 */
export interface ElectronPersistOptions<S, PersistedState = S> {
  /**
   * Name identifier for this storage (for logging)
   */
  name: string;

  /**
   * Storage adapter
   */
  storage: ElectronStorageAdapter<PersistedState>;

  /**
   * Select which part of state to persist
   */
  partialize?: (state: S) => PersistedState;

  /**
   * Merge persisted state with current state
   */
  merge?: (persistedState: PersistedState, currentState: S) => S;

  /**
   * Called when state is rehydrated from storage
   */
  onRehydrateStorage?: (state: S) => void;

  /**
   * Debounce time for auto-save (ms)
   */
  debounceMs?: number;

  /**
   * Skip initial load from storage
   */
  skipHydration?: boolean;
}

/**
 * Electron persist middleware for Zustand
 *
 * Automatically syncs state with Electron IPC storage
 *
 * @example
 * const useStore = create(
 *   electronPersist(
 *     (set, get) => ({
 *       userData: {},
 *       setUserData: (data) => set({ userData: data }),
 *     }),
 *     {
 *       name: 'user-data',
 *       storage: createUserDataAdapter(() => get().username, () => get().uuid),
 *       partialize: (state) => ({ userData: state.userData }),
 *     }
 *   )
 * );
 */
export const electronPersist = <S, PersistedState = S>(
  config: StateCreator<S, [], []>,
  options: ElectronPersistOptions<S, PersistedState>
): StateCreator<S, [], []> => {
  const {
    name,
    storage,
    partialize,
    merge,
    onRehydrateStorage,
    debounceMs = 500,
    skipHydration = false,
  } = options;

  let timeoutId: NodeJS.Timeout | null = null;

  return (set, get, api) => {
    const setState: typeof set = (...args) => {
      set(...args);

      // Debounced save
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        const state = get();
        const stateToPersist = partialize ? partialize(state) : (state as any);

        try {
          await storage.write(stateToPersist);
          console.log(`[Electron Persist] Saved "${name}"`);
        } catch (error) {
          console.error(`[Electron Persist] Failed to save "${name}":`, error);
        }
      }, debounceMs);
    };

    // Hydrate state from storage
    if (!skipHydration) {
      storage
        .read()
        .then((persistedState) => {
          if (persistedState) {
            const currentState = get();
            const mergedState = merge
              ? merge(persistedState, currentState)
              : { ...currentState, ...persistedState };

            set(mergedState as any, true);
            onRehydrateStorage?.(get());
            console.log(`[Electron Persist] Hydrated "${name}"`);
          }
        })
        .catch((error) => {
          console.error(`[Electron Persist] Failed to hydrate "${name}":`, error);
        });
    }

    const initialState = config(setState, get, api);
    return initialState;
  };
};

/**
 * Helper to create userData storage adapter with dynamic username/uuid
 */
export const createUserDataAdapter = (
  getUsername: () => string | null,
  getUUID: () => string | null
): ElectronStorageAdapter<Record<string, any>> => ({
  read: async () => {
    const username = getUsername();
    const uuid = getUUID();
    if (!username || !uuid) return null;

    try {
      const data = await window.electron.userData.readData(username, uuid);
      return data || {};
    } catch (error) {
      console.error('[UserData Adapter] Read failed:', error);
      return null;
    }
  },
  write: async (data) => {
    const username = getUsername();
    const uuid = getUUID();
    if (!username || !uuid) {
      console.warn('[UserData Adapter] Cannot write: username or UUID not set');
      return;
    }
    await window.electron.userData.writeData(username, uuid, data);
  },
  delete: async () => {
    const username = getUsername();
    const uuid = getUUID();
    if (!username || !uuid) return;
    await window.electron.userData.deleteData(username, uuid);
  },
});

/**
 * Helper to create M3U storage adapter
 */
export const createM3UAdapter = (
  getUUID: () => string | null
): ElectronStorageAdapter<{ source?: string; update?: any; stats?: any }> => ({
  read: async () => {
    const uuid = getUUID();
    if (!uuid) return null;

    try {
      const data = await window.electron.m3u.readUUID(uuid);
      return data;
    } catch (error) {
      console.error('[M3U Adapter] Read failed:', error);
      return null;
    }
  },
  write: async (data) => {
    const uuid = getUUID();
    if (!uuid) {
      console.warn('[M3U Adapter] Cannot write: UUID not set');
      return;
    }
    await window.electron.m3u.writeUUID(uuid, data);
  },
  delete: async () => {
    const uuid = getUUID();
    if (!uuid) return;
    await window.electron.m3u.deleteUUID(uuid);
  },
});

/**
 * Helper to create generic storage adapter
 */
export const createGenericAdapter = <T>(
  readFn: () => Promise<T | null>,
  writeFn: (data: T) => Promise<void>,
  deleteFn: () => Promise<void>
): ElectronStorageAdapter<T> => ({
  read: readFn,
  write: writeFn,
  delete: deleteFn,
});
