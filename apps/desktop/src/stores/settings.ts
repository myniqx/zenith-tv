import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
export type Language = 'en' | 'tr';

interface SettingsState {
  // Appearance
  theme: Theme;

  // Localization
  language: Language;

  // Content
  defaultCategory: string;
  autoSyncInterval: number; // in minutes, 0 = disabled

  // Player
  defaultVolume: number; // 0-1
  autoResume: boolean;
  autoPlayNext: boolean;

  // Network (for future P2P)
  deviceName: string;
  serverPort: number;

  // Actions
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setDefaultCategory: (category: string) => void;
  setAutoSyncInterval: (minutes: number) => void;
  setDefaultVolume: (volume: number) => void;
  setAutoResume: (enabled: boolean) => void;
  setAutoPlayNext: (enabled: boolean) => void;
  setDeviceName: (name: string) => void;
  setServerPort: (port: number) => void;
  resetSettings: () => void;
}

const defaultSettings = {
  theme: 'dark' as Theme,
  language: 'en' as Language,
  defaultCategory: 'all',
  autoSyncInterval: 0,
  defaultVolume: 0.7,
  autoResume: true,
  autoPlayNext: true,
  deviceName: 'Zenith TV',
  serverPort: 8080,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setTheme: (theme) => set({ theme }),

      setLanguage: (language) => set({ language }),

      setDefaultCategory: (category) => set({ defaultCategory: category }),

      setAutoSyncInterval: (minutes) => set({ autoSyncInterval: minutes }),

      setDefaultVolume: (volume) => {
        const clamped = Math.max(0, Math.min(1, volume));
        set({ defaultVolume: clamped });
      },

      setAutoResume: (enabled) => set({ autoResume: enabled }),

      setAutoPlayNext: (enabled) => set({ autoPlayNext: enabled }),

      setDeviceName: (name) => set({ deviceName: name }),

      setServerPort: (port) => set({ serverPort: port }),

      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'zenith-settings',
    }
  )
);
