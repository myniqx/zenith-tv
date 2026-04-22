import { create } from 'zustand';
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
  ClientEventData,
} from '@zenith-tv/content';
import { WatchableObject } from '@zenith-tv/content';
import { useContentStore } from './content';
import { useSettingsStore } from './settings';
import type { PlayerBackend, PlayerBackendCallbacks } from '../backends/playerBackend';

let initializationPromise: Promise<void> | null = null;

// P2P pending event accumulator. Backend callbacks write partial data here.
// The P2PManager interval calls flushPendingEvent() to send and reset it.
let pendingEvent: Partial<ClientEventData> = {};

interface TizenPlayerState {
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

  // Video settings (STUBS - Tizen doesn't support these)
  aspectRatio: string | null;
  crop: string | null;
  scale: number;
  deinterlace: string | null;

  // Delay settings (PARTIAL - only subtitle delay supported)
  audioDelay: number;
  subtitleDelay: number;

  // Screen mode (STUB - Tizen is always fullscreen)
  screenMode: ScreenMode;
  prevScreenMode: ScreenMode;
  stickyElement: HTMLElement | null;
  lastStickyBounds: { x: number; y: number; width: number; height: number } | undefined;
  wasPlayingBeforeMinimize: boolean;
  currentItem: WatchableObject | null;
  lastSavedTime: number;

  // Actions
  init: () => Promise<void>;
  play: (item: WatchableObject) => Promise<void>;
  setupBackend: (backend: PlayerBackend) => void;
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

  // P2P
  getFullVlcEvent: () => ClientEventData;
  flushPendingEvent: () => ClientEventData | null;

  // Helpers
  shouldStickyPanelVisible: () => boolean;

  // Internal
  _backend: PlayerBackend | null;
  _buildCallbacks: () => PlayerBackendCallbacks;
}

export const useTizenPlayerStore = create<TizenPlayerState>((set, get) => ({
  isAvailable: false,
  isInitialized: false,
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
  isSeekable: true,
  aspectRatio: null,
  crop: null,
  scale: 0,
  deinterlace: null,
  audioDelay: 0,
  subtitleDelay: 0,
  screenMode: 'fullscreen',
  prevScreenMode: 'fullscreen',
  stickyElement: null,
  lastStickyBounds: undefined,
  wasPlayingBeforeMinimize: false,
  currentItem: null,
  lastSavedTime: 0,
  _backend: null,

  // Called by VideoPlayerAVPlay or VideoPlayerHTML5 on mount
  setupBackend: (backend) => {
    const prev = get()._backend;
    if (prev) prev.destroy();
    set({ _backend: backend, isAvailable: true, isInitialized: true });
  },

  // Build callbacks that backend uses to report events back into the store
  _buildCallbacks: () => ({
    onTimeUpdate: (time, duration) => {
      const state = get();
      const position = duration > 0 ? time / duration : 0;

      set({ time, duration, position });
      pendingEvent.currentVideo = { ...pendingEvent.currentVideo, time, position };

      // Auto-save progress every 10 seconds
      if (state.currentItem && duration > 0) {
        const timeSinceLastSave = Math.abs(time - state.lastSavedTime);
        if (timeSinceLastSave >= 10) {
          useContentStore.getState().saveWatchProgress(state.currentItem, time, duration);
          set({ lastSavedTime: time });
        }
      }
    },

    onStateChange: (playerState) => {
      set({ playerState });
      pendingEvent.currentVideo = { ...pendingEvent.currentVideo, state: playerState };
    },

    onTracksReady: (audio, subtitle) => {
      set({ audioTracks: audio, subtitleTracks: subtitle });
      pendingEvent.mediaInfo = {
        ...pendingEvent.mediaInfo,
        audioTracks: audio,
        subtitleTracks: subtitle,
        videoTracks: [],
        duration: get().duration,
        isSeekable: true,
        url: get().currentItem?.Url ?? null,
      };

      // Apply saved track preferences
      const state = get();
      const savedTracks = state.currentItem?.userData?.tracks;

      if (savedTracks) {
        if (savedTracks.audio !== undefined && audio.some((t) => t.id === savedTracks.audio)) {
          state.audio({ track: savedTracks.audio });
        }
        if (savedTracks.subtitle !== undefined && subtitle.some((t) => t.id === savedTracks.subtitle)) {
          state.subtitle({ track: savedTracks.subtitle });
        }
      } else {
        const { preferredAudioLanguage, preferredSubtitleLanguage } = useSettingsStore.getState();
        const match = (name: string, lang: string) => name.toLowerCase().includes(lang.toLowerCase());

        if (preferredAudioLanguage) {
          const matched = audio.find((t) => match(t.name, preferredAudioLanguage));
          if (matched) state.audio({ track: matched.id });
        }
        if (preferredSubtitleLanguage) {
          const matched = subtitle.find((t) => match(t.name, preferredSubtitleLanguage));
          if (matched) state.subtitle({ track: matched.id });
        }
      }
    },

    onBuffering: (percent) => {
      set({ buffering: percent });
      pendingEvent.currentVideo = { ...pendingEvent.currentVideo, buffering: percent };
    },

    onError: (message) => {
      set({ playerState: 'error', error: message });
      pendingEvent.currentVideo = { ...pendingEvent.currentVideo, error: message };
    },

    onEnded: () => {
      const state = get();
      set({ playerState: 'ended' });
      pendingEvent.currentVideo = { ...pendingEvent.currentVideo, endReached: true };

      if (state.currentItem && state.duration > 0) {
        useContentStore.getState().saveWatchProgress(
          state.currentItem,
          state.duration,
          state.duration
        );
      }
    },
  }),

  init: async () => {
    const state = get();
    if (state.isInitialized) return;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
      // isAvailable and isInitialized are set by setupBackend() when a
      // VideoPlayerAVPlay or VideoPlayerHTML5 component mounts.
      initializationPromise = null;
    })();

    return initializationPromise;
  },

  play: async (item) => {
    set({ currentItem: item });
    await get().open(item.Url);
  },

  open: async (options) => {
    const { _backend, _buildCallbacks, currentItem } = get();
    if (!_backend) return;

    const url = typeof options === 'string' ? options : options.file;

    try {
      set({ playerState: 'opening', error: null });
      await _backend.open(url, _buildCallbacks());

      // Resume from saved position if available
      const savedPosition = currentItem?.userData?.position;
      if (savedPosition && savedPosition > 0) {
        _backend.seekTo(savedPosition);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to open media';
      console.error('[TizenPlayer] Open error:', error);
      set({ error: msg, playerState: 'error' });
    }
  },

  playback: async (options) => {
    const { _backend, time, duration } = get();
    if (!_backend) return;

    if (options.action) {
      switch (options.action) {
        case 'play':
        case 'resume':
          _backend.play();
          break;
        case 'pause':
          _backend.pause();
          // Save progress on pause
          {
            const state = get();
            if (state.currentItem && duration > 0) {
              useContentStore.getState().saveWatchProgress(state.currentItem, state.time, duration);
              set({ lastSavedTime: state.time });
            }
          }
          break;
        case 'stop':
          _backend.stop();
          {
            const s = get();
            if (s.currentItem && duration > 0) {
              useContentStore.getState().saveWatchProgress(s.currentItem, s.time, duration);
              set({ lastSavedTime: s.time });
            }
          }
          break;
      }
    }

    if (options.time !== undefined) _backend.seekTo(options.time);
    if (options.position !== undefined) _backend.seekTo(options.position * duration);

    if (options.rate !== undefined) {
      // Rate control only supported by AVPlay — log for HTML5
      console.warn('[TizenPlayer] Rate control may not be supported by current backend');
      set({ rate: options.rate });
      pendingEvent.playerInfo = { ...pendingEvent.playerInfo, rate: options.rate };
    }
  },

  audio: async (options) => {
    const { _backend, currentItem, currentSubtitleTrack } = get();
    if (!_backend) return;

    if (options.volume !== undefined) {
      console.warn('[TizenPlayer] Volume control not supported on Tizen');
      set({ volume: options.volume });
      pendingEvent.playerInfo = { ...pendingEvent.playerInfo, volume: options.volume };
    }

    if (options.mute !== undefined) {
      set({ isMuted: options.mute });
      pendingEvent.playerInfo = { ...pendingEvent.playerInfo, muted: options.mute };
    }

    if (options.track !== undefined) {
      _backend.setAudioTrack(options.track);
      set({ currentAudioTrack: options.track });
      pendingEvent.currentVideo = { ...pendingEvent.currentVideo, audioTrack: options.track };

      if (currentItem) {
        useContentStore.getState().saveTrackSelection(currentItem, options.track, currentSubtitleTrack);
      }
    }

    if (options.delay !== undefined) {
      console.warn('[TizenPlayer] Audio delay not supported on Tizen');
      set({ audioDelay: options.delay });
    }
  },

  video: async (options) => {
    if (options.track !== undefined) set({ currentVideoTrack: options.track });
    if (options.aspectRatio !== undefined) set({ aspectRatio: options.aspectRatio });
    if (options.crop !== undefined) set({ crop: options.crop });
    if (options.scale !== undefined) set({ scale: options.scale });
    if (options.deinterlace !== undefined) set({ deinterlace: options.deinterlace });
  },

  subtitle: async (options) => {
    const { _backend, currentItem, currentAudioTrack } = get();
    if (!_backend) return;

    if (options.track !== undefined) {
      _backend.setSubtitleTrack(options.track);
      set({ currentSubtitleTrack: options.track });
      pendingEvent.currentVideo = { ...pendingEvent.currentVideo, subtitleTrack: options.track };

      if (currentItem) {
        useContentStore.getState().saveTrackSelection(currentItem, currentAudioTrack, options.track);
      }
    }

    if (options.delay !== undefined) {
      console.warn('[TizenPlayer] Subtitle delay limited on Tizen');
      set({ subtitleDelay: options.delay });
      pendingEvent.currentVideo = { ...pendingEvent.currentVideo, subtitleDelay: options.delay };
    }
  },

  window: async (options): Promise<boolean> => {
    if (options.screenMode !== undefined) {
      set({ screenMode: 'fullscreen' });
      return options.screenMode === 'fullscreen';
    }
    if (options.resize !== undefined) {
      const { x, y, width, height } = options.resize;
      try {
        window.webapis?.avplay?.setDisplayRect(x, y, width, height);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  },

  shortcut: async () => {
    console.warn('[TizenPlayer] Keyboard shortcuts not supported on Tizen');
  },

  setScreenMode: (mode) => {
    const currentMode = get().screenMode;
    set({ prevScreenMode: currentMode, screenMode: 'fullscreen' });
  },

  setStickyElement: (element) => {
    set({ stickyElement: element });
  },

  shouldStickyPanelVisible: () => false,

  flushPendingEvent: (): ClientEventData | null => {
    if (!pendingEvent.mediaInfo && !pendingEvent.playerInfo && !pendingEvent.currentVideo) {
      return null;
    }
    if (pendingEvent.mediaInfo) {
      pendingEvent.mediaInfo.url = get().currentItem?.Url ?? null;
    }
    const flushed = pendingEvent as ClientEventData;
    pendingEvent = {};
    return flushed;
  },

  getFullVlcEvent: (): ClientEventData => {
    const s = get();
    return {
      mediaInfo: {
        duration: s.duration,
        isSeekable: s.isSeekable,
        audioTracks: s.audioTracks,
        subtitleTracks: s.subtitleTracks,
        videoTracks: s.videoTracks,
        url: s.currentItem?.Url ?? null,
      },
      playerInfo: {
        volume: s.volume,
        muted: s.isMuted,
        rate: s.rate,
        screenMode: s.screenMode,
      },
      currentVideo: {
        time: s.time,
        state: s.playerState,
        length: s.duration,
        position: s.position,
        buffering: s.buffering,
        isSeekable: s.isSeekable,
        aspectRatio: s.aspectRatio,
        crop: s.crop,
        scale: s.scale,
        deinterlace: s.deinterlace,
        audioDelay: s.audioDelay,
        subtitleDelay: s.subtitleDelay,
        audioTrack: s.currentAudioTrack,
        subtitleTrack: s.currentSubtitleTrack,
        videoTrack: s.currentVideoTrack,
      },
    };
  },
}));
