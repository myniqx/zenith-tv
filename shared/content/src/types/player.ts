// Cross-platform player types.
//
// These are shared between Desktop (VLC native) and Tizen (AVPlay). The
// type surface is modeled on VLC's capabilities; the Tizen implementation
// stubs out features it cannot support (window management, audio delay,
// video adjustments). Keeping a single type file guarantees that the P2P
// protocol stays byte-compatible across platforms.
//
// Platform-specific extensions (e.g. Electron WindowStyleOptions, React
// hook return types) live in each app's own types file.

export type VlcState =
  | 'idle'
  | 'opening'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'ended'
  | 'error'
  | 'unknown';

export type ScreenMode = 'free' | 'free_ontop' | 'sticky' | 'fullscreen';

export interface VlcTrack {
  id: number;
  name: string;
}

// ─── Unified command API (server → player) ──────────────────────────────

export interface OpenOptions {
  file: string;
}

export interface PlaybackOptions {
  action?: 'play' | 'pause' | 'resume' | 'stop';
  time?: number;
  position?: number;
  rate?: number;
}

export interface AudioOptions {
  volume?: number;
  mute?: boolean;
  track?: number;
  delay?: number;
}

export interface VideoOptions {
  track?: number;
  scale?: number;
  aspectRatio?: string;
  crop?: string;
  deinterlace?: string;
  teletext?: number;
}

export interface SubtitleOptions {
  track?: number;
  delay?: number;
}

export interface WindowResizeOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowOptions {
  resize?: WindowResizeOptions;
  visible?: boolean;
  screenMode?: ScreenMode;
}

// Shortcut action names. Desktop consumes these; Tizen ignores them
// (D-pad driven) but keeps the type around for protocol compatibility.
export type ShortcutAction =
  | 'playPause'
  | 'stop'
  | 'seekForward'        // +10s
  | 'seekBackward'       // -10s
  | 'seekForwardSmall'   // +3s
  | 'seekBackwardSmall'  // -3s
  | 'volumeUp'           // +5
  | 'volumeDown'         // -5
  | 'toggleMute'
  | 'toggleFullscreen'
  | 'exitFullscreen'
  | 'stickyMode'
  | 'freeScreenMode'
  | 'subtitleDelayPlus'  // +100ms
  | 'subtitleDelayMinus' // -100ms
  | 'subtitleDisable';

export interface ShortcutOptions {
  shortcuts: Record<ShortcutAction, string[]>;
}

// ─── VLC event payload (player → server, also used for P2P mirroring) ───

export interface MediaInfo {
  duration: number;
  isSeekable: boolean;
  audioTracks: VlcTrack[];
  subtitleTracks: VlcTrack[];
  videoTracks: VlcTrack[];
  // Only populated when the event is a full-state snapshot (sent in
  // response to state_request, or injected by the client when forwarding
  // a real mediaInfo event to the server). The remote side uses this URL
  // to resolve currentItem from its own M3U content store via findByUrl.
  url?: string | null;
}

export interface PlayerSettings {
  volume?: number;
  muted?: boolean;
  rate?: number;
  screenMode?: ScreenMode;
}

export interface CurrentVideoState {
  time?: number;
  state?: VlcState;
  endReached?: boolean;
  error?: string;
  length?: number;
  position?: number;           // 0.0 - 1.0 (normalized position)
  buffering?: number;          // 0.0 - 100.0 (buffering progress)
  isSeekable?: boolean;

  // Video settings (emitted on video load + when changed)
  aspectRatio?: string | null;
  crop?: string | null;
  scale?: number;
  deinterlace?: string | null;

  // Delay settings (absolute values in microseconds)
  audioDelay?: number;
  subtitleDelay?: number;

  // Current track selection (per-video)
  audioTrack?: number;
  subtitleTrack?: number;
  videoTrack?: number;
}

// Unified event data structure forwarded over P2P. The same shape is used
// for real VLC events and for the synthetic full-state snapshot returned
// in response to state_request — see shared/content/src/types/p2p.ts.
export interface VlcEventData {
  mediaInfo?: MediaInfo;
  playerInfo?: PlayerSettings;
  currentVideo?: CurrentVideoState;
  shortcut?: ShortcutAction;
}

// P2P message payload for client→server player state events.
// Sent by the client (desktop VLC or Tizen AVPlay) to keep the server
// UI in sync. Uses the same shape as VlcEventData since the internal
// event format and the wire format are identical.
export type ClientEventData = VlcEventData;
