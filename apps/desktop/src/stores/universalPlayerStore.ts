import { create } from 'zustand';
import { useVlcPlayerStore } from './vlcPlayer';
import { useP2PPlayerStore } from './p2pPlayerStore';
import { useP2PStore } from './p2pStore';
import { WatchableObject } from '@zenith-tv/content';
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
} from '@zenith-tv/content';

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
  noAudio: boolean | undefined;
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
}

// Active-store selection is driven by P2P mode, not by selectedDeviceId.
//
//  - mode === 'server'  → p2pPlayerStore  (this desktop is a remote control;
//                                          no local VLC, mirrors a client)
//  - otherwise          → vlcPlayerStore  ('off' or 'client' — VLC runs here)
//
// In client mode the VLC store handles both the local UI and inbound P2P
// commands, so there's only ever one real source of truth at a time.
const isServerMode = () => useP2PStore.getState().mode === 'server';

const getActiveStore = () =>
  isServerMode() ? useP2PPlayerStore.getState() : useVlcPlayerStore.getState();

// Project just the *state* fields out of a source store snapshot, so we
// don't accidentally overwrite the universal store's action functions
// when we `set()` from a subscribe callback. Zustand's set is a shallow
// merge, and without this filter the source store's actions (which close
// over the wrong store!) would replace our proxy actions.
type PlayerStateFields = Omit<
  UniversalPlayerState,
  | 'init' | 'play' | 'setScreenMode' | 'setStickyElement'
  | 'open' | 'playback' | 'audio' | 'video' | 'subtitle' | 'window' | 'shortcut'
  | 'shouldStickyPanelVisible'
>;
type AnyPlayerSnapshot = Record<string, unknown>;
const pickState = (src: AnyPlayerSnapshot): PlayerStateFields => ({
  isAvailable: src.isAvailable as boolean,
  isInitialized: src.isInitialized as boolean,
  playerState: src.playerState as VlcState,
  time: src.time as number,
  duration: src.duration as number,
  volume: src.volume as number,
  isMuted: src.isMuted as boolean,
  noAudio: src.noAudio as boolean | undefined,
  audioTracks: src.audioTracks as VlcTrack[],
  subtitleTracks: src.subtitleTracks as VlcTrack[],
  videoTracks: src.videoTracks as VlcTrack[],
  currentAudioTrack: src.currentAudioTrack as number,
  currentSubtitleTrack: src.currentSubtitleTrack as number,
  currentVideoTrack: src.currentVideoTrack as number,
  error: src.error as string | null,
  position: src.position as number,
  buffering: src.buffering as number,
  rate: src.rate as number,
  isSeekable: src.isSeekable as boolean,
  aspectRatio: src.aspectRatio as string | null,
  crop: src.crop as string | null,
  scale: src.scale as number,
  deinterlace: src.deinterlace as string | null,
  audioDelay: src.audioDelay as number,
  subtitleDelay: src.subtitleDelay as number,
  screenMode: src.screenMode as ScreenMode,
  prevScreenMode: src.prevScreenMode as ScreenMode,
  stickyElement: src.stickyElement as HTMLElement | null,
  wasPlayingBeforeMinimize: src.wasPlayingBeforeMinimize as boolean,
  currentItem: src.currentItem as WatchableObject | null,
});

export const useUniversalPlayerStore = create<UniversalPlayerState>((set) => {
  // Ensure the P2P mirror listeners are live from the start so we don't
  // miss state_update packets that arrive before the user opens the UI.
  useP2PPlayerStore.getState()._setupListeners();

  // Re-sync whenever P2P mode flips (off ↔ client ↔ server).
  useP2PStore.subscribe((state, prevState) => {
    if (state.mode !== prevState.mode) {
      set(pickState(getActiveStore() as unknown as AnyPlayerSnapshot));
    }
  });

  // Mirror local VLC store into the universal facade when we're NOT in
  // server mode. (Client mode also uses vlcPlayerStore locally.)
  useVlcPlayerStore.subscribe((state) => {
    if (!isServerMode()) set(pickState(state as unknown as AnyPlayerSnapshot));
  });

  // Mirror P2P player store into the universal facade when we ARE in
  // server mode — it's being fed by vlc_event packets from the client.
  useP2PPlayerStore.subscribe((state) => {
    if (isServerMode()) set(pickState(state as unknown as AnyPlayerSnapshot));
  });

  return {
    // Start from the VLC store as the default snapshot.
    ...pickState(useVlcPlayerStore.getState() as unknown as AnyPlayerSnapshot),

    // Actions proxy to whichever store is active at call time.
    init: async () => getActiveStore().init(),
    play: async (item) => getActiveStore().play(item),
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
