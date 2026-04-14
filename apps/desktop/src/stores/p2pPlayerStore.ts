import { create } from 'zustand';
import { useP2PStore } from './p2pStore';
import { useContentStore } from './content';
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
  ClientEventData,
  WatchableObject,
} from '@zenith-tv/content';

// Server-mode player store. Mirrors a remote client's player state via
// `client_event` messages. Does NOT drive a local VLC instance — commands
// issued here are forwarded to the client over P2P, and the echoed
// client_event (that the client sends back) is what actually moves this store.

interface P2PPlayerState {
  isAvailable: boolean;
  isInitialized: boolean;
  playerState: VlcState;
  time: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  noAudio: boolean | undefined;
  audioTracks: VlcTrack[];
  subtitleTracks: VlcTrack[];
  videoTracks: VlcTrack[];
  currentAudioTrack: number;
  currentSubtitleTrack: number;
  currentVideoTrack: number;
  error: string | null;

  position: number;
  buffering: number;
  rate: number;
  isSeekable: boolean;

  aspectRatio: string | null;
  crop: string | null;
  scale: number;
  deinterlace: string | null;

  audioDelay: number;
  subtitleDelay: number;

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

  open: (options: OpenOptions | string) => Promise<void>;
  playback: (options: PlaybackOptions) => Promise<void>;
  audio: (options: AudioOptions) => Promise<void>;
  video: (options: VideoOptions) => Promise<void>;
  subtitle: (options: SubtitleOptions) => Promise<void>;
  window: (options: WindowOptions) => Promise<boolean>;
  shortcut: (options: ShortcutOptions) => Promise<void>;

  shouldStickyPanelVisible: () => boolean;

  // Internal
  _setupListeners: () => void;
  _handleRemoteVlcEvent: (eventData: ClientEventData) => void;
  _requestFullState: (connectionId?: string) => Promise<void>;
}

// Set up listeners immediately on store creation
let listenersSetup = false;

export const useP2PPlayerStore = create<P2PPlayerState>((set, get) => ({
  // Initial state
  isAvailable: true,
  isInitialized: true,
  playerState: 'idle',
  time: 0,
  duration: 0,
  volume: 100,
  isMuted: false,
  noAudio: undefined,
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
    if (listenersSetup) return;
    listenersSetup = true;

    // Incoming messages from client(s). Only active in server mode:
    // mirror client_event packets into this store so the server UI follows
    // the client's actual player state.
    p2p.onMessage(({ message }) => {
      if (useP2PStore.getState().mode !== 'server') return;
      if (message.type === 'client_event') {
        get()._handleRemoteVlcEvent(message.payload as ClientEventData);
      }
    });
  },

  // Side-effect-free mirror of vlcPlayer.handleVlcEvent. No sticky setup,
  // no track save, no watch-progress save — the client already does all
  // of that locally. This store just reflects the state for the server UI.
  _handleRemoteVlcEvent: (eventData: ClientEventData) => {
    const state = get();

    if (eventData.mediaInfo) {
      const info = eventData.mediaInfo;
      const updates: Partial<P2PPlayerState> = {
        audioTracks: info.audioTracks,
        subtitleTracks: info.subtitleTracks,
        videoTracks: info.videoTracks,
        duration: info.duration,
        isSeekable: info.isSeekable,
      };

      // url is only populated on full_state or the synthetic snapshot the
      // client sends in response to state_request. Resolve via findByUrl.
      if (info.url !== undefined) {
        updates.currentItem = info.url
          ? useContentStore.getState().findByUrl(info.url) ?? null
          : null;
      }

      set(updates);
    }

    if (eventData.playerInfo) {
      const updates: Partial<P2PPlayerState> = {};
      const pi = eventData.playerInfo;

      // Same noAudio semantics as vlcPlayer.
      if (pi.volume !== undefined) {
        if (pi.volume < 0) {
          updates.noAudio = true;
        } else {
          updates.noAudio = false;
          updates.volume = pi.volume;
          if (pi.muted !== undefined) updates.isMuted = pi.muted;
        }
      } else if (pi.muted !== undefined && state.noAudio !== true) {
        updates.isMuted = pi.muted;
      }

      if (pi.rate !== undefined) updates.rate = pi.rate;

      if (pi.screenMode !== undefined && pi.screenMode !== state.screenMode) {
        updates.prevScreenMode = state.screenMode;
        updates.screenMode = pi.screenMode;
      }

      if (Object.keys(updates).length > 0) set(updates);
    }

    if (eventData.currentVideo) {
      const cv = eventData.currentVideo;
      const updates: Partial<P2PPlayerState> = {};

      if (cv.time !== undefined) updates.time = cv.time;
      if (cv.position !== undefined) updates.position = cv.position;
      if (cv.buffering !== undefined) updates.buffering = cv.buffering;

      if (cv.state !== undefined) {
        updates.playerState = cv.state as VlcState;
        if (cv.state === 'stopped') {
          updates.noAudio = undefined;
        }
      }

      if (cv.isSeekable !== undefined) updates.isSeekable = cv.isSeekable;
      if (cv.length !== undefined) updates.duration = cv.length;

      if (cv.aspectRatio !== undefined) updates.aspectRatio = cv.aspectRatio;
      if (cv.crop !== undefined) updates.crop = cv.crop;
      if (cv.scale !== undefined) updates.scale = cv.scale;
      if (cv.deinterlace !== undefined) updates.deinterlace = cv.deinterlace;

      if (cv.audioDelay !== undefined) updates.audioDelay = cv.audioDelay;
      if (cv.subtitleDelay !== undefined) updates.subtitleDelay = cv.subtitleDelay;

      if (cv.audioTrack !== undefined) updates.currentAudioTrack = cv.audioTrack;
      if (cv.subtitleTrack !== undefined) updates.currentSubtitleTrack = cv.subtitleTrack;
      if (cv.videoTrack !== undefined) updates.currentVideoTrack = cv.videoTrack;

      if (cv.endReached) updates.playerState = 'ended';
      if (cv.error) {
        updates.error = cv.error;
        updates.playerState = 'error';
      }

      if (Object.keys(updates).length > 0) set(updates);
    }
  },

  // Ask a specific client (or the currently selected one) for a full state
  // snapshot. The client will respond with a synthetic vlc_event.
  _requestFullState: async (connectionId?: string) => {
    const toIds = connectionId ? [connectionId] : [];
    await useP2PStore.getState().sendToPlayer(
      { type: 'state_request' },
      toIds,
    );
  },

  // ─── Commands (server → client) ──────────────────────────────────────
  //
  // All commands are forwarded to the client. State updates are not
  // applied locally — they come back through vlc_event.

  play: async (item) => {
    // Optimistic: set currentItem so UI updates immediately. The client
    // will confirm via its own vlc_event (which carries the same url).
    set({ currentItem: item });
    await get().open(item.Url);
  },

  open: async (options) => {
    await useP2PStore.getState().sendToPlayer({ type: 'open', payload: options });
  },

  playback: async (options) => {
    // Optimistic seek for snappy slider feel.
    if (options.time !== undefined) set({ time: options.time });
    await useP2PStore.getState().sendToPlayer({ type: 'playback', payload: options });
  },

  audio: async (options) => {
    await useP2PStore.getState().sendToPlayer({ type: 'audio', payload: options });
  },

  video: async (options) => {
    await useP2PStore.getState().sendToPlayer({ type: 'video', payload: options });
  },

  subtitle: async (options) => {
    await useP2PStore.getState().sendToPlayer({ type: 'subtitle', payload: options });
  },

  window: async (options) => {
    await useP2PStore.getState().sendToPlayer({ type: 'window', payload: options });
    return true;
  },

  shortcut: async (options) => {
    await useP2PStore.getState().sendToPlayer({ type: 'shortcut', payload: options });
  },

  setScreenMode: (mode) => {
    get().window({ screenMode: mode });
  },

  setStickyElement: (_element) => {
    // Sticky mode is a local-window feature driven by the client. No-op here.
  },

  shouldStickyPanelVisible: () => false,
}));
