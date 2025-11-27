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
  MediaInfo,
  PlayerInfo,
  ShortcutOptions,
} from '../types/types';

// Event listeners state - module scope (singleton)
let listenersInitialized = false;
let resizeObserver: ResizeObserver | null = null;
let lastWindowPosition: { x: number; y: number; scaleFactor: number } | null = null;

interface VlcPlayerState {
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
  currentAudioTrack: number;
  currentSubtitleTrack: number;
  error: string | null;

  // Screen mode
  screenMode: ScreenMode;
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
  getMediaInfo: () => Promise<MediaInfo | null>;
  getPlayerInfo: () => Promise<PlayerInfo | null>;

  // Internal helpers
  _setupEventListeners: () => void;
  _setupStickyMode: () => void;
  _cleanupStickyMode: () => void;
  _syncWindowBounds: (windowPos: { x: number; y: number; scaleFactor: number }) => void;
}

/* bilinen buglar

1. bir video oynatilirken %95'in altında izlendi ise bu videonun timestampını kaydetmeliyiz, %95'in üzerinde izlendi ise video bitmiş olmalı
 1.a ) bitmemiş video tekrardan oynatılmak istendiğinde otomatik olarak kaldığı yerden devam etmesi lazım content.ts saveWatchProgress fonksiyonu
 1.b ) bitmiş video'nın son kalınan yer kaydının kaldırılması lazım. content.ts saveWatchProgress (silmeli.)
 1.c ) bu saveWatchProgress fonksiyonu pause veya stop anında çalışmalı.

2. bir video play tuşuna basıldığında vlc tarafında pencere yeniden oluşturuluyor. yani bu store üzerindeki statelerden vlc'nin haberi olmuyor
  dolayısı ile bu veriler ile güncelleme gönderilmeli.

3. 

*/

export const useVlcPlayerStore = create<VlcPlayerState>((set, get) => ({
  // Initial state
  isAvailable: false,
  isInitialized: false,
  playerState: 'idle',
  time: 0,
  duration: 0,
  volume: 100,
  isMuted: false,
  audioTracks: [],
  subtitleTracks: [],
  currentAudioTrack: -1,
  currentSubtitleTrack: -1,
  error: null,
  screenMode: 'sticky',
  stickyElement: null,
  wasPlayingBeforeMinimize: false,

  // Initialize VLC player and setup event listeners
  init: async () => {
    const state = get();

    // Already initialized
    if (state.isInitialized) return;

    try {
      const available = await window.electron.vlc.isAvailable();
      set({ isAvailable: available });

      if (available) {
        const result = await window.electron.vlc.init();
        if (result.success) {
          set({ isInitialized: true });
          console.log('[VLC] Player initialized successfully');

          // Setup event listeners once
          state._setupEventListeners();
        } else {
          const errorMsg = result.error || 'Failed to initialize VLC';
          set({ error: errorMsg });
          console.error('[VLC] Initialization failed:', result.error);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to check availability';
      console.error('[VLC] Failed to check availability:', error);
      set({ isAvailable: false, error: errorMsg });
    }
  },

  // Setup event listeners (called once during init)
  _setupEventListeners: () => {
    if (listenersInitialized) return;

    const handleTimeChanged = (newTime: number) => {
      set({ time: newTime });
    };

    const handleStateChanged = (newState: string) => {
      set({ playerState: newState as VlcState });

      // Auto-fetch info when playing starts
      if (newState === 'playing') {
        get().getMediaInfo();
      }
    };

    const handleEndReached = () => {
      set({ playerState: 'ended' });
    };

    const handleError = (message: string) => {
      console.error('[VLC] Error:', message);
      set({ error: message, playerState: 'error' });
    };

    // Handle window position changes for sticky mode
    const handlePositionChanged = (data: {
      x: number;
      y: number;
      scaleFactor: number;
      minimized: boolean
    }) => {
      console.log('[VLC Sticky] Position changed:', data);
      const state = get();

      // Only handle if in sticky mode
      if (state.screenMode !== 'sticky') return;

      if (data.minimized) {
        // Window minimized - pause and hide VLC
        const isPlaying = state.playerState === 'playing';
        set({ wasPlayingBeforeMinimize: isPlaying });

        if (isPlaying) {
          state.playback({ action: 'pause' }).catch(err => {
            console.error('[VLC] Failed to pause on minimize:', err);
          });
        }

        state.window({ visible: false }).catch(err => {
          console.error('[VLC] Failed to hide on minimize:', err);
        });
      } else {
        // Window not minimized - sync bounds and show VLC
        lastWindowPosition = { x: data.x, y: data.y, scaleFactor: data.scaleFactor };

        state.window({ visible: true }).catch(err => {
          console.error('[VLC] Failed to show on restore:', err);
        });

        state._syncWindowBounds(lastWindowPosition);

        // Resume if was playing before minimize
        if (state.wasPlayingBeforeMinimize) {
          state.playback({ action: 'resume' }).catch(err => {
            console.error('[VLC] Failed to resume on restore:', err);
          });
          set({ wasPlayingBeforeMinimize: false });
        }
      }
    };

    // Handle keyboard shortcuts from native VLC window
    const handleShortcut = (action: string) => {
      console.log('[VLC] Shortcut received:', action);
      const state = get();

      // Execute action based on shortcut
      switch (action) {
        case 'playPause':
          if (state.playerState === 'playing') {
            state.playback({ action: 'pause' });
          } else {
            state.playback({ action: 'resume' });
          }
          break;

        case 'seekForward':
          state.playback({ time: Math.min(state.time + 10000, state.duration) });
          break;

        case 'seekBackward':
          state.playback({ time: Math.max(state.time - 10000, 0) });
          break;

        case 'seekForwardSmall':
          state.playback({ time: Math.min(state.time + 3000, state.duration) });
          break;

        case 'seekBackwardSmall':
          state.playback({ time: Math.max(state.time - 3000, 0) });
          break;

        case 'volumeUp':
          state.audio({ volume: Math.min(state.volume + 5, 100) });
          break;

        case 'volumeDown':
          state.audio({ volume: Math.max(state.volume - 5, 0) });
          break;

        case 'toggleMute':
          state.audio({ mute: !state.isMuted });
          break;

        case 'toggleFullscreen':
          const newMode = state.screenMode === 'fullscreen' ? 'free' : 'fullscreen';
          set({ screenMode: newMode });
          state.window({ fullscreen: newMode === 'fullscreen' });
          break;

        case 'exitFullscreen':
          set({ screenMode: 'free' });
          state.window({ fullscreen: false });
          break;

        default:
          console.warn('[VLC] Unknown shortcut action:', action);
      }
    };

    // Register VLC event listeners
    window.electron.vlc.onTimeChanged(handleTimeChanged);
    window.electron.vlc.onStateChanged(handleStateChanged);
    window.electron.vlc.onEndReached(handleEndReached);
    window.electron.vlc.onError(handleError);
    window.electron.vlc.onShortcut(handleShortcut);

    // Register window event listener (for sticky mode)
    window.electron.window.onPositionChanged(handlePositionChanged);

    listenersInitialized = true;
    console.log('[VLC] Event listeners initialized');
  },

  // Setup sticky mode element tracking
  _setupStickyMode: () => {
    const { stickyElement, screenMode, isAvailable } = get();

    // Cleanup existing observer
    get()._cleanupStickyMode();

    // Only setup if in sticky mode with element and VLC available
    if (screenMode !== 'sticky' || !stickyElement || !isAvailable) {
      return;
    }

    // Observe element resize and sync VLC window bounds
    resizeObserver = new ResizeObserver(() => {
      if (lastWindowPosition) {
        get()._syncWindowBounds(lastWindowPosition);
      }
    });

    resizeObserver.observe(stickyElement);
    console.log('[VLC] Sticky mode element tracking setup complete');
  },

  // Cleanup sticky mode observers
  _cleanupStickyMode: () => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  },

  // Sync VLC window with sticky element bounds
  _syncWindowBounds: (windowPos: { x: number; y: number; scaleFactor: number }) => {
    const { stickyElement } = get();
    if (!stickyElement) return;

    console.log('[VLC Sticky] syncWindowBounds called');
    const rect = stickyElement.getBoundingClientRect();

    // Convert client coordinates to screen coordinates
    const screenX = Math.round(windowPos.x + rect.x);
    const screenY = Math.round(windowPos.y + rect.y);
    const screenWidth = Math.round(rect.width);
    const screenHeight = Math.round(rect.height);

    const bounds = {
      x: screenX,
      y: screenY,
      width: screenWidth,
      height: screenHeight,
    };

    console.log('[VLC Sticky] Sync:', {
      electronWindow: { x: windowPos.x, y: windowPos.y, scale: windowPos.scaleFactor },
      stickyElement: {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      calculated: bounds,
      formula: `${windowPos.x} + ${Math.round(rect.x)} = ${screenX}`,
    });

    // Only update if bounds are valid
    if (bounds.width > 0 && bounds.height > 0) {
      get().window({ resize: bounds }).catch(err => {
        console.error('[VLC] Failed to sync window bounds:', err);
      });
    }
  },

  // Set screen mode and handle mode transitions
  setScreenMode: (mode: ScreenMode) => {
    const prevMode = get().screenMode;
    set({ screenMode: mode });

    const { isAvailable, window: windowApi } = get();
    if (!isAvailable) return;

    // Handle mode transitions
    switch (mode) {
      case 'fullscreen':
        windowApi({ fullscreen: true }).catch(err => {
          console.error('[VLC] Failed to set fullscreen:', err);
        });
        break;

      case 'free':
        windowApi({ fullscreen: false }).catch(err => {
          console.error('[VLC] Failed to exit fullscreen:', err);
        });
        if (prevMode === 'sticky') {
          get()._cleanupStickyMode();
        }
        break;

      case 'sticky':
        windowApi({
          fullscreen: false,
          onTop: true,
          style: { border: false, titleBar: false, resizable: false, taskbar: false }
        }).catch(err => {
          console.error('[VLC] Failed to set sticky mode:', err);
        });
        // Setup will be called when element is set
        break;
    }
  },

  // Set sticky element and setup tracking
  setStickyElement: (element: HTMLElement | null) => {
    set({ stickyElement: element });

    // Setup sticky mode if element is provided and mode is sticky
    if (element && get().screenMode === 'sticky') {
      get()._setupStickyMode();
    } else {
      get()._cleanupStickyMode();
    }
  },

  // Unified API: Open media
  open: async (options: OpenOptions | string) => {
    const { isAvailable } = get();
    if (!isAvailable) return;

    const opts = typeof options === 'string' ? { file: options } : options;
    await window.electron.vlc.open(opts);
    // TODO: pencere şu an yeni oluşturuluyor, tüm vlc stateleri kayıp,
    // ses defaultta pencere posizyonu defaultta.. bunları güncelle
  },

  // Unified API: Playback control
  playback: async (options: PlaybackOptions) => {
    const { isAvailable } = get();
    if (!isAvailable) return;

    await window.electron.vlc.playback(options);
  },

  // Unified API: Audio control
  audio: async (options: AudioOptions) => {
    const { isAvailable } = get();
    if (!isAvailable) return;

    await window.electron.vlc.audio(options);

    // Update local state
    const updates: Partial<VlcPlayerState> = {};
    if (options.volume !== undefined) updates.volume = options.volume;
    if (options.mute !== undefined) updates.isMuted = options.mute;
    if (options.track !== undefined) updates.currentAudioTrack = options.track;

    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },

  // Unified API: Video control
  video: async (options: VideoOptions) => {
    const { isAvailable } = get();
    if (!isAvailable) return;

    await window.electron.vlc.video(options);
  },

  // Unified API: Subtitle control
  subtitle: async (options: SubtitleOptions) => {
    const { isAvailable } = get();
    if (!isAvailable) return;

    await window.electron.vlc.subtitle(options);

    if (options.track !== undefined) {
      set({ currentSubtitleTrack: options.track });
    }
  },

  // Unified API: Window control
  window: async (options: WindowOptions): Promise<boolean> => {
    const { isAvailable } = get();
    if (!isAvailable) return false;

    try {
      return await window.electron.vlc.window(options);
    } catch (error) {
      console.error('[VLC] Window error:', error);
      return false;
    }
  },

  // Unified API: Keyboard shortcut configuration
  shortcut: async (options: ShortcutOptions): Promise<void> => {
    const { isAvailable } = get();
    if (!isAvailable) return;

    await window.electron.vlc.shortcut(options);
  },

  // Get media info and update state
  getMediaInfo: async (): Promise<MediaInfo | null> => {
    const { isAvailable } = get();
    if (!isAvailable) return null;

    const info = await window.electron.vlc.getMediaInfo();
    if (info) {
      set({
        audioTracks: info.audioTracks,
        subtitleTracks: info.subtitleTracks,
        currentAudioTrack: info.currentAudioTrack,
        currentSubtitleTrack: info.currentSubtitleTrack,
        duration: info.duration,
      });
    }
    return info;
  },

  // Get player info
  getPlayerInfo: async (): Promise<PlayerInfo | null> => {
    const { isAvailable } = get();
    if (!isAvailable) return null;

    return await window.electron.vlc.getPlayerInfo();
  },
}));
