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
import { useContentStore } from './content';

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
  lastSavedTime: number;

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
  lastSavedTime: 0,

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

            // Setup event listeners once
            state._setupEventListeners();
          } else {
            const errorMsg = result.error || 'Failed to initialize VLC';
            set({ error: errorMsg });
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to check availability';
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
        const info = eventData.mediaInfo;

        // Priority 1: User's saved tracks (highest priority)
        const savedTracks = state.currentItem?.userData?.tracks;
        if (savedTracks) {

          // Validate track IDs exist in current media
          if (savedTracks.audio !== undefined) {
            const audioExists = info.audioTracks.some(t => t.id === savedTracks.audio);
            if (audioExists) {
              await state.audio({ track: savedTracks.audio });
            }
          }

          if (savedTracks.subtitle !== undefined) {
            const subtitleExists = info.subtitleTracks.some(t => t.id === savedTracks.subtitle);
            if (subtitleExists) {
              await state.subtitle({ track: savedTracks.subtitle });
            }
          }
        }
        // Priority 2: Preferred language (only if no saved tracks)
        else {
          const { preferredAudioLanguage, preferredSubtitleLanguage } = useSettingsStore.getState();

          // Helper to match track name with language
          const matchTrack = (trackName: string, language: string) => {
            return trackName.toLowerCase().includes(language.toLowerCase());
          };

          // Auto-select audio track by language
          if (preferredAudioLanguage) {
            const matchedAudio = info.audioTracks.find(t => matchTrack(t.name, preferredAudioLanguage));
            if (matchedAudio && matchedAudio.id !== -1) {
              await state.audio({ track: matchedAudio.id });
            }
          }

          // Auto-select subtitle track by language
          if (preferredSubtitleLanguage) {
            const matchedSubtitle = info.subtitleTracks.find(t => matchTrack(t.name, preferredSubtitleLanguage));
            if (matchedSubtitle && matchedSubtitle.id !== -1) {
              await state.subtitle({ track: matchedSubtitle.id });
            }
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
        if (cv.time !== undefined) {
          updates.time = cv.time;

          // Auto-save progress every 10 seconds
          if (state.currentItem && state.duration > 0) {
            const timeSinceLastSave = Math.abs(cv.time - state.lastSavedTime);
            if (timeSinceLastSave >= 10) {
              useContentStore.getState().saveWatchProgress(
                state.currentItem,
                cv.time,
                state.duration
              );
              updates.lastSavedTime = cv.time;
            }
          }
        }

        if (cv.position !== undefined) updates.position = cv.position;
        if (cv.buffering !== undefined) updates.buffering = cv.buffering;

        // State updates
        if (cv.state !== undefined) {
          updates.playerState = cv.state as VlcState;

          // Immediate save on pause or stop
          if ((cv.state === 'paused' || cv.state === 'stopped') && state.currentItem && state.duration > 0) {
            useContentStore.getState().saveWatchProgress(
              state.currentItem,
              state.time,
              state.duration
            );
            updates.lastSavedTime = state.time;
          }
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
        const audioTrackChanged = cv.audioTrack !== undefined;
        const subtitleTrackChanged = cv.subtitleTrack !== undefined;

        if (audioTrackChanged) updates.currentAudioTrack = cv.audioTrack;
        if (subtitleTrackChanged) updates.currentSubtitleTrack = cv.subtitleTrack;
        if (cv.videoTrack !== undefined) updates.currentVideoTrack = cv.videoTrack;

        // End reached
        if (cv.endReached) {
          updates.playerState = 'ended';
        }

        // Error
        if (cv.error) {
          updates.error = cv.error;
          updates.playerState = 'error';
        }

        // Apply all updates at once
        if (Object.keys(updates).length > 0) {
          set(updates);
        }

        // Save track selection AFTER state update (so we have fresh values)
        if ((audioTrackChanged || subtitleTrackChanged) && state.currentItem) {
          const freshState = get();
          useContentStore.getState().saveTrackSelection(
            state.currentItem,
            freshState.currentAudioTrack,
            freshState.currentSubtitleTrack
          );
        }
      }

      // Handle Shortcut events
      if (eventData.shortcut) {
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
          state.playback({ action: 'pause' }).catch(() => {});
        }

        state.window({ visible: false }).catch(() => {});
      } else {
        // Window not minimized - sync bounds and show VLC
        state.window({ visible: true }).catch(() => {});

        // Resume if was playing before minimize
        if (state.wasPlayingBeforeMinimize) {
          state.playback({ action: 'resume' }).catch(() => {});
          set({ wasPlayingBeforeMinimize: false });
        }
      }
    };

    // Register unified VLC event listener
    window.electron.vlc.onEvent(handleVlcEvent);

    // Register window event listener (for sticky mode)
    window.electron.window.onPositionChanged(handlePositionChanged);

    listenersInitialized = true;
  },

  // Setup sticky mode element tracking
  _setupStickyMode: () => {
    const state = get();
    const { stickyElement, screenMode, isAvailable } = state;

    // Cleanup existing observer
    state._cleanupStickyMode();

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
    const state = get();
    const { stickyElement, screenMode } = state;
    if (!stickyElement) return;

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
      if (screenMode === 'sticky') {
        state.window({ resize: bounds }).catch(() => {});
      } else {
        set({ lastStickyBounds: bounds });
      }
    }
  },

  // Set screen mode and handle mode transitions
  setScreenMode: (mode: ScreenMode) => {
    const state = get();
    const { screenMode: currentMode, prevScreenMode, isAvailable, lastStickyBounds } = state;

    if (currentMode === mode) {
      mode = prevScreenMode;
    }

    if (!isAvailable) return;

    set({ prevScreenMode: currentMode });

    // Handle mode transitions
    switch (mode) {
      case 'fullscreen':
        state.window({ screenMode: 'fullscreen' }).catch(() => {});
        break;

      case 'free_ontop':
      case 'free':
        state.window({ screenMode: mode }).catch(() => {});
        if (currentMode === 'sticky') {
          state._cleanupStickyMode();
        }
        break;

      case 'sticky':
        state.window({
          screenMode: 'sticky',
          resize: lastStickyBounds
        }).catch(() => {});
        break;
    }
  },

  // Set sticky element and setup tracking
  setStickyElement: (element: HTMLElement | null) => {
    set({ stickyElement: element });

    const state = get();
    // Setup sticky mode if element is provided and mode is sticky
    if (element && state.screenMode === 'sticky') {
      state._setupStickyMode();
    } else {
      state._cleanupStickyMode();
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
    } catch {
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
