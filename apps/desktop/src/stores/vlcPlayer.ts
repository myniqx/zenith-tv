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
  VlcEventData,
} from '../types/types';
import { useSettingsStore } from './settings';
import { shortcutActions } from './helpers/shortcutAction';
import { WatchableObject } from '@zenith-tv/content';

// Event listeners state - module scope (singleton)
let resizeObserver: ResizeObserver | null = null;
let lastWindowPosition: { x: number; y: number; scaleFactor: number } | undefined = undefined;
let initializationPromise: Promise<void> | null = null;
let listenersInitialized = false;

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

  // Delay settings (microseconds)
  audioDelay: number;
  subtitleDelay: number;

  // Screen mode
  screenMode: ScreenMode;
  prevScreenMode: ScreenMode;
  stickyElement: HTMLElement | null;
  lastStickyBounds: { x: number; y: number; width: number; height: number; } | undefined;
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

  // Internal helpers
  _setupEventListeners: () => void;
  _setupStickyMode: () => void;
  _cleanupStickyMode: () => void;
  _syncWindowBounds: (windowPos: { x: number; y: number; scaleFactor: number }) => void;
  _setupVlcCore: () => void;

  // Helpers
  shouldStickyPanelVisible: () => boolean;
}

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
  lastStickyBounds: undefined,
  wasPlayingBeforeMinimize: false,
  currentItem: null,

  _setupVlcCore: async () => {
    // Register keyboard shortcuts from settings
    const settings = useSettingsStore.getState();
    const shortcuts = settings.getAllShortcuts();
    const store = get();
    await store.shortcut({ shortcuts });

    await store.audio({
      volume: store.volume,
    });

    await store.playback({
      rate: store.rate,
    });
  },

  // Initialize VLC player and setup event listeners
  init: async () => {
    const state = get();

    // Already initialized
    if (state.isInitialized) return;

    // Return existing promise if initialization is in progress
    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = (async () => {
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
      } finally {
        // Reset promise on completion (success or fail)
        // If successful, isInitialized will block future calls.
        // If failed, we allow retry.
        initializationPromise = null;
      }
    })();

    return initializationPromise;
  },

  // Setup event listeners (called once during init)
  _setupEventListeners: () => {
    if (listenersInitialized) return;

    // Unified event handler
    const handleVlcEvent = async (eventData: VlcEventData) => {
      const state = get();

      // Handle MediaInfo updates
      if (eventData.mediaInfo) {
        console.log('[VLC] MediaInfo event received:', eventData.mediaInfo);
        const info = eventData.mediaInfo;
        const { preferredAudioLanguage, preferredSubtitleLanguage } = useSettingsStore.getState();

        // Helper to match track name with language
        const matchTrack = (trackName: string, language: string) => {
          return trackName.toLowerCase().includes(language.toLowerCase());
        };

        // Auto-select audio track
        if (preferredAudioLanguage) {
          const matchedAudio = info.audioTracks.find(t => matchTrack(t.name, preferredAudioLanguage));
          if (matchedAudio && matchedAudio.id !== -1) {
            state.audio({ track: matchedAudio.id });
          }
        }

        // Auto-select subtitle track
        if (preferredSubtitleLanguage) {
          const matchedSubtitle = info.subtitleTracks.find(t => matchTrack(t.name, preferredSubtitleLanguage));
          if (matchedSubtitle && matchedSubtitle.id !== -1) {
            state.subtitle({ track: matchedSubtitle.id });
          }
        }

        set({
          audioTracks: info.audioTracks,
          subtitleTracks: info.subtitleTracks,
          videoTracks: info.videoTracks,
          duration: info.duration,
        });

        // if this function is called, that means vlc is initialized for current video
        // so register keyboard shortcuts from settings and etc.
        await state._setupVlcCore();
      }

      // Handle PlayerInfo updates
      if (eventData.playerInfo) {
        console.log('[VLC] PlayerInfo event received:', eventData.playerInfo);
        const updates: Partial<VlcPlayerState> = {};

        if (eventData.playerInfo.volume !== undefined) updates.volume = eventData.playerInfo.volume;
        if (eventData.playerInfo.muted !== undefined) updates.isMuted = eventData.playerInfo.muted;
        if (eventData.playerInfo.rate !== undefined) updates.rate = eventData.playerInfo.rate;
        if (eventData.playerInfo.screenMode !== undefined) updates.screenMode = eventData.playerInfo.screenMode;

        if (Object.keys(updates).length > 0) {
          set(updates);
        }
      }

      // Handle CurrentVideo updates
      if (eventData.currentVideo) {
        const cv = eventData.currentVideo;
        const updates: Partial<VlcPlayerState> = {};

        // Time updates
        if (cv.time !== undefined) updates.time = cv.time;
        if (cv.position !== undefined) updates.position = cv.position;
        if (cv.buffering !== undefined) updates.buffering = cv.buffering;

        // State updates
        if (cv.state !== undefined) {
          updates.playerState = cv.state as VlcState;
        }

        // Playback info
        if (cv.isSeekable !== undefined) updates.isSeekable = cv.isSeekable;
        if (cv.length !== undefined) updates.duration = cv.length;

        // Video settings
        if (cv.aspectRatio !== undefined) updates.aspectRatio = cv.aspectRatio;
        if (cv.crop !== undefined) updates.crop = cv.crop;
        if (cv.scale !== undefined) updates.scale = cv.scale;
        if (cv.deinterlace !== undefined) updates.deinterlace = cv.deinterlace;

        // Delay settings
        if (cv.audioDelay !== undefined) updates.audioDelay = cv.audioDelay;
        if (cv.subtitleDelay !== undefined) updates.subtitleDelay = cv.subtitleDelay;

        // Track changes
        if (cv.audioTrack !== undefined) updates.currentAudioTrack = cv.audioTrack;
        if (cv.subtitleTrack !== undefined) updates.currentSubtitleTrack = cv.subtitleTrack;
        if (cv.videoTrack !== undefined) updates.currentVideoTrack = cv.videoTrack;

        // End reached
        if (cv.endReached) {
          updates.playerState = 'ended';
        }

        // Error
        if (cv.error) {
          console.error('[VLC] Error:', cv.error);
          updates.error = cv.error;
          updates.playerState = 'error';
        }

        // Apply all updates at once
        if (Object.keys(updates).length > 0) {
          set(updates);
        }
      }

      // Handle Shortcut events
      if (eventData.shortcut) {
        console.log('[VLC] Shortcut received:', eventData.shortcut);
        const action = eventData.shortcut;

        shortcutActions(state, action);
      }
    };

    // Handle window position changes for sticky mode
    const handlePositionChanged = (data: {
      x: number;
      y: number;
      scaleFactor: number;
      minimized: boolean
    }) => {
      const state = get();

      // Always update last known position
      lastWindowPosition = { x: data.x, y: data.y, scaleFactor: data.scaleFactor };

      // Always try to sync/cache bounds
      state._syncWindowBounds(lastWindowPosition);

      // Only handle visibility/playback if in sticky mode
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
        state.window({ visible: true }).catch(err => {
          console.error('[VLC] Failed to show on restore:', err);
        });

        // Resume if was playing before minimize
        if (state.wasPlayingBeforeMinimize) {
          state.playback({ action: 'resume' }).catch(err => {
            console.error('[VLC] Failed to resume on restore:', err);
          });
          set({ wasPlayingBeforeMinimize: false });
        }
      }
    };

    // Register unified VLC event listener
    window.electron.vlc.onEvent(handleVlcEvent);

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


    // Only update if bounds are valid
    if (bounds.width > 0 && bounds.height > 0) {
      if (get().screenMode === 'sticky') {
        get().window({ resize: bounds }).catch(err => {
          console.error('[VLC] Failed to sync window bounds:', err);
        });
      } else {
        set({ lastStickyBounds: bounds });
      }
    }
  },

  // Set screen mode and handle mode transitions
  setScreenMode: (mode: ScreenMode) => {
    const currentMode = get().screenMode;
    if (currentMode === mode) {
      mode = get().prevScreenMode;
    }

    const { isAvailable, window: windowApi } = get();
    if (!isAvailable) return;

    set({ prevScreenMode: currentMode });

    // Handle mode transitions
    switch (mode) {
      case 'fullscreen':
        windowApi({ screenMode: 'fullscreen' }).catch(err => {
          console.error('[VLC] Failed to set fullscreen:', err);
        });
        break;

      case 'free_ontop':
      case 'free':
        windowApi({
          screenMode: mode
        }).catch(err => {
          console.error('[VLC] Failed to set screen mode:', err);
        });
        if (currentMode === 'sticky') {
          get()._cleanupStickyMode();
        }
        break;

      case 'sticky':
        const { lastStickyBounds } = get();
        windowApi({
          screenMode: 'sticky',
          resize: lastStickyBounds
        }).catch(err => {
          console.error('[VLC] Failed to set sticky mode:', err);
        });
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

  // Play item
  play: async (item: WatchableObject) => {
    const { open } = get();
    set({ currentItem: item });
    await open(item.Url);
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

  // Helper: Check if sticky panel should be visible
  shouldStickyPanelVisible: () => {
    const { playerState, screenMode } = get();
    const isPlayingOrPaused = playerState === 'playing' || playerState === 'paused' || playerState === 'buffering' || playerState === 'opening';
    return isPlayingOrPaused && screenMode === 'sticky';
  },
}));
