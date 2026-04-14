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
import type { AVPlayTrackInfo, AVPlayState } from '../types/tizen';
import { WatchableObject } from '@zenith-tv/content';
import { useContentStore } from './content';
import { useSettingsStore } from './settings';

// Singleton state for event listeners
let listenersInitialized = false;
let initializationPromise: Promise<void> | null = null;

// P2P pending event accumulator. AVPlay callbacks write partial data here.
// The P2PManager interval calls flushPendingEvent() to send and reset it.
// Kept outside Zustand to avoid type spread issues with ClientEventData.
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

  // P2P: Build a ClientEventData snapshot of the full current state.
  // Used to answer `state_request` from the server.
  getFullVlcEvent: () => ClientEventData;

  // P2P: Flush accumulated pending event data. Returns null if nothing changed.
  flushPendingEvent: () => ClientEventData | null;

  // Internal helpers
  _setupEventListeners: () => void;
  _setupTizenCore: () => void;
  _mapAVPlayState: (avplayState: AVPlayState) => VlcState;
  _mapTracksToVlcFormat: (tracks: AVPlayTrackInfo[]) => {
    audio: VlcTrack[];
    subtitle: VlcTrack[];
    video: VlcTrack[];
  };

  // Helpers
  shouldStickyPanelVisible: () => boolean;
}

export const useTizenPlayerStore = create<TizenPlayerState>((set, get) => ({
  // Initial state
  isAvailable: false,
  isInitialized: false,
  playerState: 'idle',
  time: 0,
  duration: 0,
  volume: 100, // STUB: Tizen doesn't provide app-level volume control
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
  isSeekable: true, // Most IPTV streams are seekable
  aspectRatio: null,
  crop: null,
  scale: 0,
  deinterlace: null,
  audioDelay: 0,
  subtitleDelay: 0,
  screenMode: 'fullscreen', // Tizen is always fullscreen
  prevScreenMode: 'fullscreen',
  stickyElement: null,
  lastStickyBounds: undefined,
  wasPlayingBeforeMinimize: false,
  currentItem: null,
  lastSavedTime: 0,

  // Map AVPlay state to VLC state format
  _mapAVPlayState: (avplayState: AVPlayState): VlcState => {
    switch (avplayState) {
      case 'NONE':
      case 'IDLE':
        return 'idle';
      case 'READY':
        return 'opening';
      case 'PLAYING':
        return 'playing';
      case 'PAUSED':
        return 'paused';
      default:
        return 'unknown';
    }
  },

  // Convert Tizen track format to VLC track format
  _mapTracksToVlcFormat: (tracks: AVPlayTrackInfo[]) => {
    const audio: VlcTrack[] = [];
    const subtitle: VlcTrack[] = [];
    const video: VlcTrack[] = [];

    tracks.forEach((track) => {
      let name = `Track ${track.index}`;

      // Parse extra_info JSON if available
      if (track.extra_info) {
        try {
          const info = JSON.parse(track.extra_info);
          if (info.language) {
            name = `${info.language.toUpperCase()}`;
            if (info.channels) {
              name += ` (${info.channels}ch)`;
            }
          }
        } catch {
          // If parsing fails, use default name
        }
      }

      const vlcTrack: VlcTrack = {
        id: track.index,
        name,
      };

      if (track.type === 'AUDIO') {
        audio.push(vlcTrack);
      } else if (track.type === 'TEXT') {
        subtitle.push(vlcTrack);
      } else if (track.type === 'VIDEO') {
        video.push(vlcTrack);
      }
    });

    return { audio, subtitle, video };
  },

  _setupTizenCore: async () => {
    // Core setup (volume, rate, etc.)
    // Note: Tizen doesn't have app-level volume control
    const state = get();

    // Set playback rate if supported
    if (state.rate !== 1.0) {
      try {
        window.webapis?.avplay?.setSpeed(state.rate);
      } catch (error) {
        console.warn('[Tizen] Failed to set playback rate:', error);
      }
    }
  },

  // Initialize Tizen AVPlay and setup event listeners
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
        // Check if Tizen webapis is available
        const available = !!window.webapis?.avplay;
        set({ isAvailable: available });

        if (available) {
          // AVPlay doesn't need explicit init, just check state
          const currentState = window.webapis.avplay.getState();
          set({
            isInitialized: true,
            playerState: state._mapAVPlayState(currentState),
          });

          // Setup event listeners once
          state._setupEventListeners();
        } else {
          set({ error: 'Tizen AVPlay API not available' });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to initialize AVPlay';
        set({ isAvailable: false, error: errorMsg });
      } finally {
        initializationPromise = null;
      }
    })();

    return initializationPromise;
  },

  // Setup AVPlay event listeners (called once during init)
  _setupEventListeners: () => {
    if (listenersInitialized) return;

    const avplay = window.webapis?.avplay;
    if (!avplay) return;

    avplay.setListener({
      // Playback completed
      onstreamcompleted: () => {
        const state = get();
        set({ playerState: 'ended' });
        pendingEvent.currentVideo = { ...pendingEvent.currentVideo, endReached: true };

        // Save final progress
        if (state.currentItem && state.duration > 0) {
          useContentStore.getState().saveWatchProgress(
            state.currentItem,
            state.duration,
            state.duration
          );
        }
      },

      // Time updates (periodic callback with current position in milliseconds)
      oncurrentplaytime: (currentTime: number) => {
        const state = get();
        const timeInSeconds = Math.floor(currentTime / 1000);
        const position = state.duration > 0 ? timeInSeconds / state.duration : 0;

        set({
          time: timeInSeconds,
          position,
        });

        pendingEvent.currentVideo = {
          ...pendingEvent.currentVideo,
          time: timeInSeconds,
          position,
        };

        // Auto-save progress every 10 seconds
        if (state.currentItem && state.duration > 0) {
          const timeSinceLastSave = Math.abs(timeInSeconds - state.lastSavedTime);
          if (timeSinceLastSave >= 10) {
            useContentStore.getState().saveWatchProgress(
              state.currentItem,
              timeInSeconds,
              state.duration
            );
            set({ lastSavedTime: timeInSeconds });
          }
        }
      },

      // Buffering started
      onbufferingstart: () => {
        set({ playerState: 'buffering', buffering: 0 });
        pendingEvent.currentVideo = { ...pendingEvent.currentVideo, state: 'buffering', buffering: 0 };
      },

      // Buffering progress (0-100)
      onbufferingprogress: (percent: number) => {
        set({ buffering: percent });
        pendingEvent.currentVideo = { ...pendingEvent.currentVideo, buffering: percent };
      },

      // Buffering completed
      onbufferingcomplete: () => {
        set({ playerState: 'playing', buffering: 0 });
        pendingEvent.currentVideo = { ...pendingEvent.currentVideo, state: 'playing', buffering: 0 };
      },

      // Error occurred
      onerror: (errorType: string) => {
        console.error('[Tizen] AVPlay error:', errorType);
        set({
          error: `AVPlay error: ${errorType}`,
          playerState: 'error',
        });
        pendingEvent.currentVideo = { ...pendingEvent.currentVideo, error: `AVPlay error: ${errorType}` };
      },

      // Error with message
      onerrormsg: (errorType: string, errorMsg: string) => {
        console.error('[Tizen] AVPlay error:', errorType, errorMsg);
        set({
          error: `${errorType}: ${errorMsg}`,
          playerState: 'error',
        });
        pendingEvent.currentVideo = { ...pendingEvent.currentVideo, error: `${errorType}: ${errorMsg}` };
      },

      // Subtitle change
      onsubtitlechange: (duration, subtitles, type, attributes) => {
        // Handle subtitle display updates if needed
        console.log('[Tizen] Subtitle changed:', subtitles);
      },
    });

    listenersInitialized = true;
  },

  // Play item
  play: async (item: WatchableObject) => {
    const { open } = get();
    set({ currentItem: item });
    await open(item.Url);
  },

  // Unified API: Open media
  open: async (options: OpenOptions | string) => {
    const { isAvailable, _mapTracksToVlcFormat, _setupTizenCore } = get();
    if (!isAvailable) return;

    const avplay = window.webapis?.avplay;
    if (!avplay) return;

    try {
      const url = typeof options === 'string' ? options : options.file;

      // Close previous session if any
      try {
        const currentState = avplay.getState();
        if (currentState !== 'NONE' && currentState !== 'IDLE') {
          avplay.stop();
        }
        if (currentState !== 'NONE') {
          avplay.close();
        }
      } catch {
        // Ignore errors during cleanup
      }

      // Open new URL
      set({ playerState: 'opening', error: null });
      avplay.open(url);

      // Prepare (loads metadata and creates decoder)
      avplay.prepare();

      // Get duration and track info
      const duration = Math.floor(avplay.getDuration() / 1000); // Convert ms to seconds
      const trackInfo = avplay.getTotalTrackInfo();
      const tracks = _mapTracksToVlcFormat(trackInfo);

      set({
        duration,
        audioTracks: tracks.audio,
        subtitleTracks: tracks.subtitle,
        videoTracks: tracks.video,
        playerState: 'paused', // Ready to play
      });

      pendingEvent.mediaInfo = {
        duration,
        isSeekable: true,
        audioTracks: tracks.audio,
        subtitleTracks: tracks.subtitle,
        videoTracks: tracks.video,
      };

      // Apply user's saved track preferences
      const state = get();
      const savedTracks = state.currentItem?.userData?.tracks;

      if (savedTracks) {
        // Validate and apply saved audio track
        if (savedTracks.audio !== undefined) {
          const audioExists = tracks.audio.some((t) => t.id === savedTracks.audio);
          if (audioExists) {
            await state.audio({ track: savedTracks.audio });
          }
        }

        // Validate and apply saved subtitle track
        if (savedTracks.subtitle !== undefined) {
          const subtitleExists = tracks.subtitle.some((t) => t.id === savedTracks.subtitle);
          if (subtitleExists) {
            await state.subtitle({ track: savedTracks.subtitle });
          }
        }
      }
      // Apply preferred language if no saved tracks
      else {
        const { preferredAudioLanguage, preferredSubtitleLanguage } = useSettingsStore.getState();

        // Helper to match track name with language
        const matchTrack = (trackName: string, language: string) => {
          return trackName.toLowerCase().includes(language.toLowerCase());
        };

        // Auto-select audio track by language
        if (preferredAudioLanguage) {
          const matchedAudio = tracks.audio.find((t) => matchTrack(t.name, preferredAudioLanguage));
          if (matchedAudio && matchedAudio.id !== -1) {
            await state.audio({ track: matchedAudio.id });
          }
        }

        // Auto-select subtitle track by language
        if (preferredSubtitleLanguage) {
          const matchedSubtitle = tracks.subtitle.find((t) =>
            matchTrack(t.name, preferredSubtitleLanguage)
          );
          if (matchedSubtitle && matchedSubtitle.id !== -1) {
            await state.subtitle({ track: matchedSubtitle.id });
          }
        }
      }

      // Setup core player settings
      await _setupTizenCore();

      // Auto-play
      avplay.play();
      set({ playerState: 'playing' });
      pendingEvent.currentVideo = { ...pendingEvent.currentVideo, state: 'playing' };

      // Resume from saved position if available
      const savedPosition = state.currentItem?.userData?.position;
      if (savedPosition && savedPosition > 0) {
        const seekTime = Math.floor(savedPosition * 1000); // Convert seconds to ms
        avplay.seekTo(seekTime);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to open media';
      console.error('[Tizen] Open error:', error);
      set({ error: errorMsg, playerState: 'error' });
    }
  },

  // Unified API: Playback control
  playback: async (options: PlaybackOptions) => {
    const { isAvailable, currentItem, time, duration } = get();
    if (!isAvailable) return;

    const avplay = window.webapis?.avplay;
    if (!avplay) return;

    try {
      // Handle actions
      if (options.action) {
        switch (options.action) {
          case 'play':
          case 'resume':
            avplay.play();
            set({ playerState: 'playing' });
            pendingEvent.currentVideo = { ...pendingEvent.currentVideo, state: 'playing' };
            break;

          case 'pause':
            avplay.pause();
            set({ playerState: 'paused' });
            pendingEvent.currentVideo = { ...pendingEvent.currentVideo, state: 'paused' };

            // Save progress on pause
            if (currentItem && duration > 0) {
              useContentStore.getState().saveWatchProgress(currentItem, time, duration);
              set({ lastSavedTime: time });
            }
            break;

          case 'stop':
            avplay.stop();
            set({ playerState: 'stopped' });
            pendingEvent.currentVideo = { ...pendingEvent.currentVideo, state: 'stopped' };

            // Save progress on stop
            if (currentItem && duration > 0) {
              useContentStore.getState().saveWatchProgress(currentItem, time, duration);
              set({ lastSavedTime: time });
            }
            break;
        }
      }

      // Handle seek by time (absolute position in seconds)
      if (options.time !== undefined) {
        const seekTime = Math.floor(options.time * 1000); // Convert to milliseconds
        avplay.seekTo(seekTime);
      }

      // Handle seek by position (0.0 - 1.0)
      if (options.position !== undefined) {
        const seekTime = Math.floor(options.position * duration * 1000);
        avplay.seekTo(seekTime);
      }

      // Handle playback rate
      if (options.rate !== undefined) {
        // Tizen supports specific rate values: -16, -8, -4, -2, 1, 2, 4, 8, 16
        const validRates = [-16, -8, -4, -2, 1, 2, 4, 8, 16];
        const closestRate = validRates.reduce((prev, curr) =>
          Math.abs(curr - options.rate!) < Math.abs(prev - options.rate!) ? curr : prev
        );
        avplay.setSpeed(closestRate);
        set({ rate: closestRate });
        pendingEvent.playerInfo = { ...pendingEvent.playerInfo, rate: closestRate };
      }
    } catch (error) {
      console.error('[Tizen] Playback error:', error);
      set({ error: error instanceof Error ? error.message : 'Playback control failed' });
    }
  },

  // Unified API: Audio control
  audio: async (options: AudioOptions) => {
    const { isAvailable, currentItem } = get();
    if (!isAvailable) return;

    const avplay = window.webapis?.avplay;
    if (!avplay) return;

    try {
      // STUB: Volume control
      // Tizen does NOT provide application-level volume control.
      // System volume is controlled via TV remote only.
      if (options.volume !== undefined) {
        console.warn(
          '[Tizen] Volume control not supported - Tizen uses system-level volume via TV remote'
        );
        // Update local state for UI purposes, but it won't affect actual volume
        set({ volume: options.volume });
        pendingEvent.playerInfo = { ...pendingEvent.playerInfo, volume: options.volume };
      }

      // STUB: Mute control
      // Tizen provides enableAudioStream/disableAudioStream but these are for
      // enabling/disabling audio output entirely, not for muting.
      if (options.mute !== undefined) {
        if (options.mute) {
          avplay.disableAudioStream();
        } else {
          avplay.enableAudioStream();
        }
        set({ isMuted: options.mute });
        pendingEvent.playerInfo = { ...pendingEvent.playerInfo, muted: options.mute };
      }

      // Track selection
      if (options.track !== undefined) {
        if (options.track === -1) {
          // Disable audio (not typical, but supported)
          avplay.disableAudioStream();
          set({ currentAudioTrack: -1 });
          pendingEvent.currentVideo = { ...pendingEvent.currentVideo, audioTrack: -1 };
        } else {
          avplay.setSelectTrack('AUDIO', options.track);
          set({ currentAudioTrack: options.track });
          pendingEvent.currentVideo = { ...pendingEvent.currentVideo, audioTrack: options.track };

          // Save track selection
          if (currentItem) {
            const state = get();
            useContentStore
              .getState()
              .saveTrackSelection(currentItem, options.track, state.currentSubtitleTrack);
          }
        }
      }

      // STUB: Audio delay
      // Tizen AVPlay does NOT support audio delay adjustment.
      // Only subtitle delay is supported via setSubtitlePosition.
      if (options.delay !== undefined) {
        console.warn(
          '[Tizen] Audio delay not supported - AVPlay API does not provide audio delay control. Only subtitle delay is available via subtitle() method.'
        );
        // Update local state for UI purposes
        set({ audioDelay: options.delay });
        pendingEvent.currentVideo = { ...pendingEvent.currentVideo, audioDelay: options.delay };
      }
    } catch (error) {
      console.error('[Tizen] Audio control error:', error);
      set({ error: error instanceof Error ? error.message : 'Audio control failed' });
    }
  },

  // Unified API: Video control
  video: async (options: VideoOptions) => {
    const { isAvailable } = get();
    if (!isAvailable) return;

    // STUB: All video settings
    // Tizen AVPlay does NOT support these video adjustments:
    // - aspectRatio: No API for aspect ratio control
    // - crop: No API for cropping
    // - scale: No API for scaling
    // - deinterlace: No API for deinterlace control
    // - teletext: Not applicable for IPTV streams

    if (options.track !== undefined) {
      console.warn(
        '[Tizen] Video track selection not supported - AVPlay setSelectTrack only works for AUDIO and TEXT types, not VIDEO'
      );
      // Update local state for UI consistency
      set({ currentVideoTrack: options.track });
    }

    if (options.aspectRatio !== undefined) {
      console.warn(
        '[Tizen] Aspect ratio control not supported - AVPlay does not provide aspectRatio API. Video displays in native aspect ratio.'
      );
      set({ aspectRatio: options.aspectRatio });
    }

    if (options.crop !== undefined) {
      console.warn(
        '[Tizen] Crop control not supported - AVPlay does not provide crop API. Use setDisplayRect for positioning only.'
      );
      set({ crop: options.crop });
    }

    if (options.scale !== undefined) {
      console.warn(
        '[Tizen] Scale control not supported - AVPlay does not provide scale API. Video scales automatically to display rect.'
      );
      set({ scale: options.scale });
    }

    if (options.deinterlace !== undefined) {
      console.warn(
        '[Tizen] Deinterlace control not supported - AVPlay handles deinterlacing automatically.'
      );
      set({ deinterlace: options.deinterlace });
    }
  },

  // Unified API: Subtitle control
  subtitle: async (options: SubtitleOptions) => {
    const { isAvailable, currentItem, currentAudioTrack } = get();
    if (!isAvailable) return;

    const avplay = window.webapis?.avplay;
    if (!avplay) return;

    try {
      // Track selection
      if (options.track !== undefined) {
        if (options.track === -1) {
          // Disable subtitles
          avplay.setSilentSubtitle(true);
          set({ currentSubtitleTrack: -1 });
          pendingEvent.currentVideo = { ...pendingEvent.currentVideo, subtitleTrack: -1 };
        } else {
          avplay.setSelectTrack('TEXT', options.track);
          avplay.setSilentSubtitle(false);
          set({ currentSubtitleTrack: options.track });
          pendingEvent.currentVideo = { ...pendingEvent.currentVideo, subtitleTrack: options.track };

          // Save track selection
          if (currentItem) {
            useContentStore
              .getState()
              .saveTrackSelection(currentItem, currentAudioTrack, options.track);
          }
        }
      }

      // Subtitle delay (position adjustment in milliseconds)
      if (options.delay !== undefined) {
        // Convert microseconds to milliseconds
        const delayMs = Math.floor(options.delay / 1000);
        avplay.setSubtitlePosition(delayMs);
        set({ subtitleDelay: options.delay });
        pendingEvent.currentVideo = { ...pendingEvent.currentVideo, subtitleDelay: options.delay };
      }
    } catch (error) {
      console.error('[Tizen] Subtitle control error:', error);
      set({ error: error instanceof Error ? error.message : 'Subtitle control failed' });
    }
  },

  // Unified API: Window control (STUB)
  window: async (options: WindowOptions): Promise<boolean> => {
    const { isAvailable } = get();
    if (!isAvailable) return false;

    // STUB: Window management
    // Tizen TV apps are ALWAYS fullscreen. There is no windowed mode.
    // The only positioning control is setDisplayRect which sets the video
    // display area within the screen, not window positioning.

    if (options.screenMode !== undefined) {
      console.warn(
        '[Tizen] Screen mode control not supported - Tizen TV apps are always fullscreen. setDisplayRect() can position video area within screen, but cannot create floating windows or sticky mode like VLC.'
      );

      // Update local state for UI consistency
      // Always report 'fullscreen' as that's the only mode
      set({ screenMode: 'fullscreen' });

      // If user requested fullscreen, consider it successful
      return options.screenMode === 'fullscreen';
    }

    if (options.resize !== undefined) {
      console.warn(
        '[Tizen] Window resize not supported - Use setDisplayRect() for video positioning only. This controls video display area, not window bounds.'
      );

      // Could potentially use setDisplayRect here for video positioning
      // but it's not the same as VLC window positioning
      const { x, y, width, height } = options.resize;
      try {
        window.webapis?.avplay?.setDisplayRect(x, y, width, height);
        return true;
      } catch {
        return false;
      }
    }

    if (options.visible !== undefined) {
      console.warn(
        '[Tizen] Window visibility control not supported - Tizen apps are always visible when active. No minimize/hide functionality.'
      );
      return false;
    }

    return false;
  },

  // Unified API: Keyboard shortcut configuration (STUB)
  shortcut: async (options: ShortcutOptions): Promise<void> => {
    // STUB: Keyboard shortcuts
    // Tizen Smart TVs use D-pad (directional pad) navigation via remote control,
    // not keyboard input. There is no keyboard shortcut API.
    // Navigation is handled via React Navigation and focus management.

    console.warn(
      '[Tizen] Keyboard shortcuts not supported - Tizen TVs use D-pad remote control navigation. Implement navigation using focus management (onKeyDown events for ArrowUp/Down/Left/Right/Enter/Back).'
    );

    if (options.shortcuts) {
      console.log(
        '[Tizen] Shortcuts config ignored:',
        Object.keys(options.shortcuts).join(', ')
      );
    }
  },

  // Set screen mode (STUB)
  setScreenMode: (mode: ScreenMode) => {
    // STUB: Screen mode
    // Tizen is always fullscreen, but we update state for UI consistency
    console.warn(
      '[Tizen] setScreenMode called with:',
      mode,
      '- Tizen apps are always fullscreen'
    );

    const currentMode = get().screenMode;
    set({
      prevScreenMode: currentMode,
      screenMode: 'fullscreen', // Always fullscreen on Tizen
    });
  },

  // Set sticky element (STUB)
  setStickyElement: (element: HTMLElement | null) => {
    // STUB: Sticky element
    // No sticky mode on Tizen (no floating windows)
    console.warn(
      '[Tizen] setStickyElement called - Sticky mode not available on Tizen (no window positioning)'
    );
    set({ stickyElement: element });
  },

  // Helper: Check if sticky panel should be visible (STUB)
  shouldStickyPanelVisible: () => {
    // STUB: Always false on Tizen (no sticky mode)
    return false;
  },

  flushPendingEvent: (): ClientEventData | null => {
    if (!pendingEvent.mediaInfo && !pendingEvent.playerInfo && !pendingEvent.currentVideo) {
      return null;
    }

    // Inject currentItem URL into mediaInfo if present
    if (pendingEvent.mediaInfo) {
      pendingEvent.mediaInfo.url = get().currentItem?.Url ?? null;
    }

    const flushed = pendingEvent as ClientEventData;
    pendingEvent = {};
    return flushed;
  },

  // Build a ClientEventData snapshot for P2P sync. The URL is injected
  // from currentItem so the server can resolve its own WatchableObject
  // via findByUrl — same pattern as the desktop vlcPlayer store.
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
