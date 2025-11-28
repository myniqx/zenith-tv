import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light' | 'system';
export type Language = 'en' | 'tr';
export type BufferSize = 5 | 10 | 15 | 30;
export type PlayerBackend = 'html5' | 'vlc' | 'auto';

export interface KeyboardShortcuts {
  // Player
  playPause: string;
  seekForward: string;
  seekBackward: string;
  seekForwardSmall: string;
  seekBackwardSmall: string;
  volumeUp: string;
  volumeDown: string;
  toggleMute: string;
  toggleFullscreen: string;
  exitFullscreen: string;
  // Navigation
  openSearch: string;
  openSettings: string;
  openProfileManager: string;
}

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


  // Keyboard Shortcuts
  keyboardShortcuts: KeyboardShortcuts;

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
  setKeyboardShortcut: (action: keyof KeyboardShortcuts, key: string) => void;
  resetKeyboardShortcuts: () => void;
  setDeviceName: (name: string) => void;
  setServerPort: (port: number) => void;
  resetSettings: () => void;
}

export const defaultKeyboardShortcuts: KeyboardShortcuts = {
  // Player
  playPause: 'Space',
  seekForward: 'ArrowRight',
  seekBackward: 'ArrowLeft',
  seekForwardSmall: 'shift+ArrowRight',
  seekBackwardSmall: 'shift+ArrowLeft',
  volumeUp: 'ArrowUp',
  volumeDown: 'ArrowDown',
  toggleMute: 'KeyM',
  toggleFullscreen: 'KeyF',
  exitFullscreen: 'Escape',
  // Navigation
  openSearch: 'ctrl+KeyF',
  openSettings: 'ctrl+Comma',
  openProfileManager: 'ctrl+KeyP',
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
    (set) => ({
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

      setKeyboardShortcut: (action, key) =>
        set((state) => ({
          keyboardShortcuts: {
            ...state.keyboardShortcuts,
            [action]: key,
          },
        })),

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
