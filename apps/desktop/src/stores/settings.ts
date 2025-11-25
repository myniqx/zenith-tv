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
  volumeUp: string;
  volumeDown: string;
  toggleMute: string;
  toggleFullscreen: string;
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

  // Player
  playerBackend: PlayerBackend;
  defaultVolume: number; // 0-1
  autoResume: boolean;
  autoPlayNext: boolean;
  bufferSize: BufferSize;

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
  setPlayerBackend: (backend: PlayerBackend) => void;
  setDefaultVolume: (volume: number) => void;
  setAutoResume: (enabled: boolean) => void;
  setAutoPlayNext: (enabled: boolean) => void;
  setBufferSize: (size: BufferSize) => void;
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
  volumeUp: 'ArrowUp',
  volumeDown: 'ArrowDown',
  toggleMute: 'KeyM',
  toggleFullscreen: 'KeyF',
  // Navigation
  openSearch: 'ctrl+KeyF',
  openSettings: 'ctrl+Comma',
  openProfileManager: 'ctrl+KeyP',
};

const defaultSettings = {
  theme: 'dark' as Theme,
  language: 'en' as Language,
  playerBackend: 'auto' as PlayerBackend,
  defaultVolume: 0.7,
  autoResume: true,
  autoPlayNext: true,
  bufferSize: 10 as BufferSize,
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

      setPlayerBackend: (backend) => set({ playerBackend: backend }),

      setDefaultVolume: (volume) => {
        const clamped = Math.max(0, Math.min(1, volume));
        set({ defaultVolume: clamped });
      },

      setAutoResume: (enabled) => set({ autoResume: enabled }),

      setAutoPlayNext: (enabled) => set({ autoPlayNext: enabled }),

      setBufferSize: (size) => set({ bufferSize: size }),

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
