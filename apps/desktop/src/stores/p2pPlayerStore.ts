import { create } from 'zustand';
import { useP2PStore } from './p2pStore';
import { p2p } from '../libs/p2p';
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
import { WatchableObject } from '@zenith-tv/content';

// We need to define the same interface as VlcPlayerState but for P2P
// Ideally we should extract a common interface, but for now we'll duplicate the structure
// to ensure compatibility with useUniversalPlayerStore.

interface P2PPlayerState {
  // State (Mirrored from remote)
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
  currentItem: WatchableObject | null;

  // Actions
  init: () => Promise<void>;
  play: (item: WatchableObject) => Promise<void>;
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

  // Internal
  _setupListeners: () => void;
}

export const useP2PPlayerStore = create<P2PPlayerState>((set, get) => ({
  // Initial state
  isAvailable: true, // Always true for P2P controller
  isInitialized: true,
  playerState: 'idle',
  time: 0,
  duration: 0,
  volume: 100,
  isMuted: false,
  audioTracks: [],
  subtitleTracks: [],
  videoTracks: [],
  currentAudioTrack: -1,
  currentSubtitleTrack: -1,
  currentVideoTrack: -1,
  error: null,
  position: 0,
  buffering: 0,
  rate: 1.0,
  isSeekable: false,
  aspectRatio: null,
  crop: null,
  scale: 0,
  deinterlace: null,
  audioDelay: 0,
  subtitleDelay: 0,
  screenMode: 'free',
  prevScreenMode: 'free',
  stickyElement: null,
  wasPlayingBeforeMinimize: false,
  currentItem: null,

  init: async () => {
    get()._setupListeners();
  },

  _setupListeners: () => {
    // Listen for state updates from the remote device
    p2p.onMessage(({ message }) => {
      if (message.type === 'state_update') {
        const state = message.payload as Partial<P2PPlayerState>;
        // Map remote state to local state
        // We might need to map specific fields if they differ
        set(state);
      }
    });
  },

  // Actions - Send commands via P2P
  play: async (item) => {
    set({ currentItem: item });
    await get().open(item.Url);
  },

  open: async (options) => {
    await useP2PStore.getState().sendToPlayer({
      type: 'open',
      payload: options
    });
  },

  playback: async (options) => {
    // Special handling for seek to update local optimistic state
    if (options.time !== undefined) {
      set({ time: options.time });
    }

    await useP2PStore.getState().sendToPlayer({
      type: 'playback',
      payload: options
    });
  },

  audio: async (options) => {
    await useP2PStore.getState().sendToPlayer({
      type: 'audio',
      payload: options
    });
  },

  video: async (options) => {
    await useP2PStore.getState().sendToPlayer({
      type: 'video',
      payload: options
    });
  },

  subtitle: async (options) => {
    await useP2PStore.getState().sendToPlayer({
      type: 'subtitle',
      payload: options
    });
  },

  window: async (options) => {
    await useP2PStore.getState().sendToPlayer({
      type: 'window',
      payload: options
    });
    return true;
  },

  shortcut: async (options) => {
    await useP2PStore.getState().sendToPlayer({
      type: 'shortcut',
      payload: options
    });
  },

  setScreenMode: (mode) => {
    // For remote control, we probably don't change local screen mode?
    // Or maybe we send a command to change remote screen mode?
    // Let's assume we send command.
    get().window({ screenMode: mode });
    set({ screenMode: mode });
  },

  setStickyElement: (_element) => {
    // Sticky mode is a local window feature, probably not relevant for remote control
    // or maybe we want to show the remote video in a sticky player locally? (Streaming?)
    // For now, no-op.
  },

  shouldStickyPanelVisible: () => false,
}));
