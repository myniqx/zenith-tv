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
    };
  }
}

export {};
