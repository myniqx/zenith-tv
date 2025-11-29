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

  // Internal helpers
  _setupEventListeners: () => void;
  _setupStickyMode: () => void;
  _cleanupStickyMode: () => void;
  _syncWindowBounds: (windowPos: { x: number; y: number; scaleFactor: number }) => void;
  _setupVlcCore: () => void;

  // Helpers
  shouldStickyPanelVisible: () => boolean;
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
  stickyElement: null,
  wasPlayingBeforeMinimize: false,

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
        windowApi({ fullscreen: true, onTop: false }).catch(err => {
          console.error('[VLC] Failed to set fullscreen:', err);
        });
        break;

      case 'free':
        windowApi({
          fullscreen: false,
          onTop: false,
          style: {
            border: true, titleBar: true, resizable: true, taskbar: true
          }
        }).catch(err => {
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

  // Helper: Check if sticky panel should be visible
  shouldStickyPanelVisible: () => {
    const { playerState, screenMode } = get();
    const isPlayingOrPaused = playerState === 'playing' || playerState === 'paused' || playerState === 'buffering' || playerState === 'opening';
    return isPlayingOrPaused && screenMode === 'sticky';
  },
}));
