// Player Types (compatible with VLC player interface)

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

export interface WindowOptions {
  resize?: WindowResizeOptions;
  visible?: boolean;
  screenMode?: ScreenMode;
}

// Shortcut action types
export type ShortcutAction =
  | 'playPause'
  | 'stop'
  | 'seekForward'
  | 'seekBackward'
  | 'seekForwardSmall'
  | 'seekBackwardSmall'
  | 'volumeUp'
  | 'volumeDown'
  | 'toggleMute'
  | 'toggleFullscreen'
  | 'exitFullscreen'
  | 'stickyMode'
  | 'freeScreenMode'
  | 'subtitleDelayPlus'
  | 'subtitleDelayMinus'
  | 'subtitleDisable';

export interface ShortcutOptions {
  shortcuts: Record<ShortcutAction, string[]>;
}
