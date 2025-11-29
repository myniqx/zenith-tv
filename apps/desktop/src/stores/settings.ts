import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ShortcutAction } from '@/types/types';

export type Theme = 'dark' | 'light' | 'system';
export type Language = 'en' | 'tr';
export type BufferSize = 5 | 10 | 15 | 30;
export type PlayerBackend = 'html5' | 'vlc' | 'auto';

interface SettingsState {
  // Appearance
  theme: Theme;

  // TODO: Implement i18n support
  language: Language;

  defaultVolume: number; // 0-1

  autoResume: boolean;
  autoPlayNext: boolean;
  preferredAudioLanguage: string | null;
  preferredSubtitleLanguage: string | null;

  // Startup
  autoLoadLastProfile: boolean;
  rememberLayout: boolean;
  lastProfileUsername: string | null;
  lastProfileUUID: string | null;


  // Keyboard Shortcuts (ShortcutAction -> string[])
  keyboardShortcuts: Record<ShortcutAction, string[]>;

  // TODO: Enable when P2P is ready
  deviceName: string;
  serverPort: number;

  // Actions
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setDefaultVolume: (volume: number) => void;
  setAutoResume: (enabled: boolean) => void;
  setAutoPlayNext: (enabled: boolean) => void;
  setPreferredAudioLanguage: (language: string | null) => void;
  setPreferredSubtitleLanguage: (language: string | null) => void;

  setAutoLoadLastProfile: (enabled: boolean) => void;
  setRememberLayout: (enabled: boolean) => void;
  setLastProfile: (username: string, uuid: string) => void;

  // Shortcut management
  setKeyboardShortcut: (action: ShortcutAction, keys: string[]) => void;
  addKeyToShortcut: (action: ShortcutAction, key: string) => void;
  removeKeyFromShortcut: (action: ShortcutAction, key: string) => void;
  getAllShortcuts: () => Record<ShortcutAction, string[]>;
  resetKeyboardShortcuts: () => void;

  setDeviceName: (name: string) => void;
  setServerPort: (port: number) => void;
  resetSettings: () => void;
}

export const defaultKeyboardShortcuts: Record<ShortcutAction, string[]> = {
  // Player controls
  playPause: ['Space', 'KeyK'],
  stop: ['KeyS'],
  seekForward: ['ArrowRight'],
  seekBackward: ['ArrowLeft'],
  seekForwardSmall: ['shift+ArrowRight'],
  seekBackwardSmall: ['shift+ArrowLeft'],
  volumeUp: ['ArrowUp', 'MouseWheelUp'],
  volumeDown: ['ArrowDown', 'MouseWheelDown'],
  toggleMute: ['KeyM'],

  // Screen modes
  toggleFullscreen: ['KeyF', 'F11'],
  exitFullscreen: ['Escape'],
  stickyMode: ['KeyT'],
  freeScreenMode: ['KeyQ'],

  // Subtitle controls
  subtitleDelayPlus: ['KeyH'],
  subtitleDelayMinus: ['KeyG'],
  subtitleDisable: ['KeyV'],
};

const defaultSettings = {
  theme: 'dark' as Theme,
  language: 'en' as Language,
  defaultVolume: 0.7,
  autoResume: true,
  autoPlayNext: true,
  preferredAudioLanguage: null as string | null,
  preferredSubtitleLanguage: null as string | null,
  autoLoadLastProfile: false,
  rememberLayout: false,
  lastProfileUsername: null as string | null,
  lastProfileUUID: null as string | null,
  keyboardShortcuts: defaultKeyboardShortcuts,
  deviceName: 'Zenith TV',
  serverPort: 8080,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      setTheme: (theme) => set({ theme }),

      setLanguage: (language) => set({ language }),
      setDefaultVolume: (volume) => {
        const clamped = Math.max(0, Math.min(1, volume));
        set({ defaultVolume: clamped });
      },
      setAutoResume: (enabled) => set({ autoResume: enabled }),
      setAutoPlayNext: (enabled) => set({ autoPlayNext: enabled }),
      setPreferredAudioLanguage: (language) => set({ preferredAudioLanguage: language }),
      setPreferredSubtitleLanguage: (language) => set({ preferredSubtitleLanguage: language }),

      setAutoLoadLastProfile: (enabled) => set({ autoLoadLastProfile: enabled }),

      setRememberLayout: (enabled) => set({ rememberLayout: enabled }),

      setLastProfile: (username: string, uuid: string) => set({ lastProfileUsername: username, lastProfileUUID: uuid }),

      // Set all keys for an action (replaces existing keys)
      setKeyboardShortcut: (action, keys) =>
        set((state) => ({
          keyboardShortcuts: {
            ...state.keyboardShortcuts,
            [action]: keys,
          },
        })),

      // Add a key to an action (max 2 keys, removes duplicate from other actions)
      addKeyToShortcut: (action, key) =>
        set((state) => {
          const newShortcuts = { ...state.keyboardShortcuts };

          // Remove key from any other action that has it
          Object.entries(newShortcuts).forEach(([otherAction, keys]) => {
            if (otherAction !== action && keys.includes(key)) {
              newShortcuts[otherAction as ShortcutAction] = keys.filter(k => k !== key);
            }
          });

          // Add key to target action (max 2 keys)
          const currentKeys = newShortcuts[action] || [];
          if (!currentKeys.includes(key)) {
            if (currentKeys.length >= 2) {
              // Replace the second key if we already have 2
              newShortcuts[action] = [currentKeys[0], key];
            } else {
              newShortcuts[action] = [...currentKeys, key];
            }
          }

          return { keyboardShortcuts: newShortcuts };
        }),

      // Remove a key from an action
      removeKeyFromShortcut: (action, key) =>
        set((state) => ({
          keyboardShortcuts: {
            ...state.keyboardShortcuts,
            [action]: state.keyboardShortcuts[action].filter(k => k !== key),
          },
        })),

      // Get all shortcuts (for exporting to VLC player)
      getAllShortcuts: () => get().keyboardShortcuts,

      resetKeyboardShortcuts: () =>
        set({ keyboardShortcuts: defaultKeyboardShortcuts }),

      setDeviceName: (name) => set({ deviceName: name }),

      setServerPort: (port) => set({ serverPort: port }),

      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'zenith-settings',
    }
  )
);
