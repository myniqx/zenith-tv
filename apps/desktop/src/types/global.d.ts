import type { IPCBridge } from './ipc';
import type { OpenOptions, PlaybackOptions, AudioOptions, VideoOptions, SubtitleOptions, WindowOptions, ShortcutOptions, MediaInfo, PlayerInfo, VlcPlayerState, VlcEventData } from './types';

declare global {
  interface Window {
    electron: IPCBridge & {
      platform: string;
      version: string;

      network: {
        getLocalIP: () => Promise<string>;
      };

      p2p: {
        start: (port?: number, deviceName?: string) => Promise<boolean>;
        stop: () => Promise<boolean>;
        send: (connectionId: string, message: unknown) => Promise<boolean>;
        broadcast: (message: unknown) => Promise<void>;
        getDeviceInfo: () => Promise<{ id: string; name: string; port: number } | null>;

        onConnection: (callback: (data: { connectionId: string; ip: string }) => void) => void;
        onMessage: (callback: (data: { connectionId: string; message: unknown }) => void) => void;
        onDisconnection: (callback: (connectionId: string) => void) => void;
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
