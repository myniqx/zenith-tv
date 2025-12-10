import { create } from 'zustand';
import { useVlcPlayerStore } from './vlcPlayer';
import { useP2PPlayerStore } from './p2pPlayerStore';
import { useP2PStore } from './p2pStore';
import type {
  VlcState,
  VlcTrack,
  ScreenMode,
  OpenOptions,
  PlaybackOptions,
  AudioOptions,
  VideoOptions,
  SubtitleOptions,
  WindowOptions,
  ShortcutOptions,
} from '../types/types';

// Define the interface (same as VlcPlayerState)
interface UniversalPlayerState {
  // State
  isAvailable: boolean;
  isInitialized: boolean;
  playerState: VlcState;
  time: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  audioTracks: VlcTrack[];
  subtitleTracks: VlcTrack[];
  videoTracks: VlcTrack[];
  currentAudioTrack: number;
  currentSubtitleTrack: number;
  currentVideoTrack: number;
  error: string | null;

  // Playback info
  position: number;
  buffering: number;
  rate: number;
  isSeekable: boolean;

  // Video settings
  aspectRatio: string | null;
  crop: string | null;
  scale: number;
  deinterlace: string | null;

  // Delay settings
  audioDelay: number;
  subtitleDelay: number;

  // Screen mode
  screenMode: ScreenMode;
  prevScreenMode: ScreenMode;
  stickyElement: HTMLElement | null;
  wasPlayingBeforeMinimize: boolean;

  // Actions
  init: () => Promise<void>;
  setScreenMode: (mode: ScreenMode) => void;
  setStickyElement: (element: HTMLElement | null) => void;

  // Unified API
  open: (options: OpenOptions | string) => Promise<void>;
  playback: (options: PlaybackOptions) => Promise<void>;
  audio: (options: AudioOptions) => Promise<void>;
  video: (options: VideoOptions) => Promise<void>;
  subtitle: (options: SubtitleOptions) => Promise<void>;
  window: (options: WindowOptions) => Promise<boolean>;
  shortcut: (options: ShortcutOptions) => Promise<void>;

  // Helpers
  shouldStickyPanelVisible: () => boolean;
}

// Helper to get the active store
const getActiveStore = () => {
  const selectedDeviceId = useP2PStore.getState().selectedDeviceId;
  return selectedDeviceId ? useP2PPlayerStore.getState() : useVlcPlayerStore.getState();
};

// Helper to subscribe to active store changes
// This is tricky because we need to sync state from whichever store is active.
// For now, we'll just proxy the actions and let the components subscribe to the store they need?
// No, the components will subscribe to useUniversalPlayerStore.
// So useUniversalPlayerStore needs to sync its state with the active store.

export const useUniversalPlayerStore = create<UniversalPlayerState>((set) => {

  // Subscribe to P2P Store to handle device switching
  useP2PStore.subscribe((state, prevState) => {
    if (state.selectedDeviceId !== prevState.selectedDeviceId) {
      const newActiveStore = state.selectedDeviceId ? useP2PPlayerStore.getState() : useVlcPlayerStore.getState();
      set(newActiveStore);
    }
  });

  // Subscribe to Local Store
  useVlcPlayerStore.subscribe((state) => {
    if (!useP2PStore.getState().selectedDeviceId) {
      set(state);
    }
  });

  // Subscribe to Remote Store
  useP2PPlayerStore.subscribe((state) => {
    if (useP2PStore.getState().selectedDeviceId) {
      set(state);
    }
  });

  return {
    // Initial state (Local default)
    ...useVlcPlayerStore.getState(),

    // Actions (Proxy)
    init: async () => getActiveStore().init(),
    setScreenMode: (mode) => getActiveStore().setScreenMode(mode),
    setStickyElement: (element) => getActiveStore().setStickyElement(element),
    open: async (opts) => getActiveStore().open(opts),
    playback: async (opts) => getActiveStore().playback(opts),
    audio: async (opts) => getActiveStore().audio(opts),
    video: async (opts) => getActiveStore().video(opts),
    subtitle: async (opts) => getActiveStore().subtitle(opts),
    window: async (opts) => getActiveStore().window(opts),
    shortcut: async (opts) => getActiveStore().shortcut(opts),
    shouldStickyPanelVisible: () => getActiveStore().shouldStickyPanelVisible(),
  };
});
