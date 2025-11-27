import type { IPCBridge } from './ipc';

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
        open: (options: { file: string }) => Promise<void>;
        playback: (options: {
          action?: 'play' | 'pause' | 'resume' | 'stop';
          time?: number;
          position?: number;
          rate?: number;
        }) => Promise<void>;
        audio: (options: { volume?: number; mute?: boolean; track?: number; delay?: number }) => Promise<void>;
        video: (options: { track?: number }) => Promise<void>;
        subtitle: (options: { track?: number; delay?: number }) => Promise<void>;
        window: (options: {
          resize?: { x: number; y: number; width: number; height: number };
          fullscreen?: boolean;
          onTop?: boolean;
          visible?: boolean;
          style?: { border?: boolean; titleBar?: boolean; resizable?: boolean };
        }) => Promise<boolean>;
        getMediaInfo: () => Promise<{
          duration: number;
          isSeekable: boolean;
          audioTracks: Array<{ id: number; name: string }>;
          subtitleTracks: Array<{ id: number; name: string }>;
          currentAudioTrack: number;
          currentSubtitleTrack: number;
        } | null>;
        getPlayerInfo: () => Promise<{
          time: number;
          length: number;
          state: VlcPlayerState;
          isPlaying: boolean;
        } | null>;

        // Event listeners
        onTimeChanged: (callback: (time: number) => void) => void;
        onStateChanged: (callback: (state: VlcPlayerState) => void) => void;
        onEndReached: (callback: () => void) => void;
        onError: (callback: (message: string) => void) => void;
      };
    };
  }

  interface VlcTrack {
    id: number;
    name: string;
  }

  type VlcPlayerState =
    | 'idle'
    | 'opening'
    | 'buffering'
    | 'playing'
    | 'paused'
    | 'stopped'
    | 'ended'
    | 'error'
    | 'unknown';
}

export { };
