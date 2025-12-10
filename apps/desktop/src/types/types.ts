// VLC Player Types

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

// Unified API Options
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

export interface WindowStyleOptions {
  border?: boolean;
  titleBar?: boolean;
  resizable?: boolean;
  taskbar?: boolean;
}

export interface WindowOptions {
  resize?: WindowResizeOptions;
  visible?: boolean;
  screenMode?: ScreenMode;
}

// Shortcut action types
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
  shortcuts: Record<ShortcutAction, string[]>; // { "playPause": ["Space", "KeyK"], "volumeUp": ["ArrowUp"] }
}

// Unified API Response Types
export interface MediaInfo {
  duration: number;
  isSeekable: boolean;
  audioTracks: VlcTrack[];
  subtitleTracks: VlcTrack[];
  videoTracks: VlcTrack[];
}

export interface PlayerSettings {
  volume?: number;
  muted?: boolean;
  rate?: number;
  screenMode?: ScreenMode;
}

export interface CurrentVideoState {
  // Playback info
  time?: number;
  state?: VlcState;
  endReached?: boolean;
  error?: string;
  length?: number;
  position?: number;           // 0.0 - 1.0 (normalized position)
  buffering?: number;          // 0.0 - 100.0 (buffering progress, only when buffering)
  isSeekable?: boolean;        // Real-time seekability

  // Video settings (set on video load + when changed)
  aspectRatio?: string | null;
  crop?: string | null;
  scale?: number;
  deinterlace?: string | null;

  // Delay settings (absolute values in microseconds)
  audioDelay?: number;
  subtitleDelay?: number;

  // Current tracks (per-video selection)
  audioTrack?: number;
  subtitleTrack?: number;
  videoTrack?: number;
}

// Unified Event Data Structure
export interface VlcEventData {
  mediaInfo?: MediaInfo;
  playerInfo?: PlayerSettings;
  currentVideo?: CurrentVideoState;
  shortcut?: ShortcutAction;
}

// Hook Return Type
export interface UseVlcPlayerReturn {
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
}
