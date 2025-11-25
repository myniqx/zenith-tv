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
        // Initialize VLC player (returns MessagePort for frame transfer in canvas mode)
        init: () => Promise<{ success: boolean; framePort?: MessagePort; error?: string }>;

        // Window mode: Child window management
        createChildWindow: (x: number, y: number, width: number, height: number) => Promise<{ success: boolean; error?: string }>;
        destroyChildWindow: () => Promise<{ success: boolean; error?: string }>;
        setBounds: (x: number, y: number, width: number, height: number) => Promise<boolean>;
        showWindow: () => Promise<boolean>;
        hideWindow: () => Promise<boolean>;

        // Canvas mode: Setup video callback for frame rendering
        setupVideoCallback: (width: number, height: number) => Promise<{ success: boolean; error?: string }>;

        // Playback control
        play: (url?: string) => Promise<boolean>;
        pause: () => Promise<void>;
        resume: () => Promise<void>;
        stop: () => Promise<void>;
        seek: (time: number) => Promise<void>;

        // Volume
        setVolume: (volume: number) => Promise<void>;
        getVolume: () => Promise<number>;
        setMute: (mute: boolean) => Promise<void>;
        getMute: () => Promise<boolean>;

        // Time/Position
        getTime: () => Promise<number>;
        getLength: () => Promise<number>;
        getPosition: () => Promise<number>;
        setPosition: (position: number) => Promise<void>;

        // State
        getState: () => Promise<VlcPlayerState>;
        isPlaying: () => Promise<boolean>;
        isSeekable: () => Promise<boolean>;

        // Audio tracks
        getAudioTracks: () => Promise<VlcTrack[]>;
        getAudioTrack: () => Promise<number>;
        setAudioTrack: (trackId: number) => Promise<boolean>;

        // Subtitle tracks
        getSubtitleTracks: () => Promise<VlcTrack[]>;
        getSubtitleTrack: () => Promise<number>;
        setSubtitleTrack: (trackId: number) => Promise<boolean>;
        setSubtitleDelay: (delay: number) => Promise<boolean>;

        // Video tracks
        getVideoTracks: () => Promise<VlcTrack[]>;

        // Playback rate
        setRate: (rate: number) => Promise<void>;
        getRate: () => Promise<number>;

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

export {};
