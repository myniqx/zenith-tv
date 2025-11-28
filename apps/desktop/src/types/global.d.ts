import type { IPCBridge } from './ipc';
import type { OpenOptions, PlaybackOptions, AudioOptions, VideoOptions, SubtitleOptions, WindowOptions, ShortcutOptions, MediaInfo, PlayerInfo, VlcPlayerState, VlcEventData } from './types';

declare global {
  interface Window {
    electron: IPCBridge & {
      platform: string;
      version: string;

      p2p: {
        start: (port: number) => Promise<void>;
        stop: () => Promise<void>;
        acceptPairing: (deviceId: string, pin: string) => Promise<void>;
        rejectPairing: (deviceId: string) => Promise<void>;
        broadcastState: (state: any) => Promise<void>;
        getDeviceInfo: () => Promise<any>;
        onPairingRequest: (callback: (data: any) => void) => void;
        onPlay: (callback: (data: any) => void) => void;
        onPause: (callback: () => void) => void;
        onSeek: (callback: (position: number) => void) => void;
        onSetVolume: (callback: (volume: number) => void) => void;
      };

      vlc: {
        isAvailable: () => Promise<boolean>;
        init: () => Promise<{ success: boolean; framePort?: MessagePort; error?: string }>;

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

        // Unified event listener
        onEvent: (callback: (eventData: VlcEventData) => void) => void;
      };
      window: {
        onPositionChanged: (callback: (data: { x: number; y: number; scaleFactor: number; minimized: boolean }) => void) => void;
      };
    };
  }
}

export { };
