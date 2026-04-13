import type { VlcState, ScreenMode, VlcTrack, OpenOptions, PlaybackOptions, AudioOptions, VideoOptions, SubtitleOptions, WindowOptions, ShortcutOptions } from '@zenith-tv/content';

// Electron-specific window styling knobs (native window chrome). Not
// applicable to Tizen since TV apps are always fullscreen.
export interface WindowStyleOptions {
  border?: boolean;
  titleBar?: boolean;
  resizable?: boolean;
  taskbar?: boolean;
}

// Desktop React hook return type — kept local to this app.
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
