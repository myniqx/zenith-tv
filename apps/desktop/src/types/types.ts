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

export type ScreenMode = 'free' | 'sticky' | 'fullscreen';

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
  fullscreen?: boolean;
  onTop?: boolean;
  visible?: boolean;
  style?: WindowStyleOptions;
}

export interface ShortcutOptions {
  shortcuts: Record<string, string>; // { "Space": "playPause", "Escape": "exitFullscreen" }
}

// Unified API Response Types
export interface MediaInfo {
  duration: number;
  isSeekable: boolean;
  audioTracks: VlcTrack[];
  subtitleTracks: VlcTrack[];
  currentAudioTrack: number;
  currentSubtitleTrack: number;
}

export interface PlayerInfo {
  time: number;
  length: number;
  state: VlcState;
  isPlaying: boolean;
}

export interface PlayerSettings {
  volume?: number;
  muted?: boolean;
  rate?: number;
}

export interface CurrentVideoState {
  time?: number;
  state?: VlcState;
  endReached?: boolean;
  error?: string;
  length?: number;
}

// Unified Event Data Structure
export interface VlcEventData {
  mediaInfo?: MediaInfo;
  playerInfo?: PlayerSettings;
  currentVideo?: CurrentVideoState;
  shortcut?: string;
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
  currentAudioTrack: number;
  currentSubtitleTrack: number;
  error: string | null;

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
  getMediaInfo: () => Promise<MediaInfo | null>;
  getPlayerInfo: () => Promise<PlayerInfo | null>;
}
