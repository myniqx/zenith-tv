import { useCallback, useEffect, useState, useRef } from 'react';
import type {
  VlcState,
  VlcTrack,
  OpenOptions,
  PlaybackOptions,
  AudioOptions,
  VideoOptions,
  SubtitleOptions,
  WindowOptions,
  MediaInfo,
  PlayerInfo,
  UseVlcPlayerReturn,
} from './types';

/**
 * Hook for using the native VLC player with unified API
 */
export function useVlcPlayer(): UseVlcPlayerReturn {
  // State
  const [isAvailable, setIsAvailable] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [playerState, setPlayerState] = useState<VlcState>('idle');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [audioTracks, setAudioTracks] = useState<VlcTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<VlcTrack[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState(-1);
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const isInitializing = useRef(false);

  // Unified API Methods (defined early to be used in wrappers)
  const open = useCallback(async (options: OpenOptions | string) => {
    if (!isAvailable) return;
    const opts = typeof options === 'string' ? { file: options } : options;
    await window.electron.vlc.open(opts);
  }, [isAvailable]);

  const playback = useCallback(async (options: PlaybackOptions) => {
    if (!isAvailable) return;
    await window.electron.vlc.playback(options);
  }, [isAvailable]);

  const audio = useCallback(async (options: AudioOptions) => {
    if (!isAvailable) return;
    await window.electron.vlc.audio(options);
    if (options.volume !== undefined) setVolumeState(options.volume);
    if (options.mute !== undefined) setIsMuted(options.mute);
    if (options.track !== undefined) setCurrentAudioTrack(options.track);
  }, [isAvailable]);

  const video = useCallback(async (options: VideoOptions) => {
    if (!isAvailable) return;
    await window.electron.vlc.video(options);
  }, [isAvailable]);

  const subtitle = useCallback(async (options: SubtitleOptions) => {
    if (!isAvailable) return;
    await window.electron.vlc.subtitle(options);
    if (options.track !== undefined) setCurrentSubtitleTrack(options.track);
  }, [isAvailable]);

  const windowApi = useCallback(async (options: WindowOptions): Promise<boolean> => {
    if (!isAvailable) return false;
    try {
      return await window.electron.vlc.window(options);
    } catch (error) {
      console.error('[VLC] Window error:', error);
      return false;
    }
  }, [isAvailable]);

  const getMediaInfo = useCallback(async (): Promise<MediaInfo | null> => {
    if (!isAvailable) return null;
    const info = await window.electron.vlc.getMediaInfo();
    if (info) {
      setAudioTracks(info.audioTracks);
      setSubtitleTracks(info.subtitleTracks);
      setCurrentAudioTrack(info.currentAudioTrack);
      setCurrentSubtitleTrack(info.currentSubtitleTrack);
      setDuration(info.duration);
    }
    return info;
  }, [isAvailable]);

  const getPlayerInfo = useCallback(async (): Promise<PlayerInfo | null> => {
    if (!isAvailable) return null;
    return await window.electron.vlc.getPlayerInfo();
  }, [isAvailable]);

  // Check VLC availability and initialize on mount
  useEffect(() => {
    const checkAndInit = async () => {
      if (isInitializing.current) return;
      isInitializing.current = true;

      try {
        const available = await window.electron.vlc.isAvailable();
        setIsAvailable(available);

        if (available) {
          const result = await window.electron.vlc.init();
          if (result.success) {
            setIsInitialized(true);
            console.log('[VLC] Player initialized successfully');
          } else {
            setError(result.error || 'Failed to initialize VLC');
            console.error('[VLC] Initialization failed:', result.error);
          }
        }
      } catch (error) {
        console.error('[VLC] Failed to check availability:', error);
        setIsAvailable(false);
        setError(error instanceof Error ? error.message : 'Failed to check availability');
      } finally {
        isInitializing.current = false;
      }
    };

    checkAndInit();
  }, []);

  // Event handlers
  useEffect(() => {
    if (!isAvailable) return;

    const handleTimeChanged = (newTime: number) => {
      setTime(newTime);
    };

    const handleStateChanged = (newState: string) => {
      setPlayerState(newState as VlcState);
      // Auto-fetch info when playing starts
      if (newState === 'playing') {
        getMediaInfo();
      }
    };

    const handleEndReached = () => {
      setPlayerState('ended');
    };

    const handleError = (message: string) => {
      console.error('[VLC] Error:', message);
      setError(message);
      setPlayerState('error');
    };

    window.electron.vlc.onTimeChanged(handleTimeChanged);
    window.electron.vlc.onStateChanged(handleStateChanged);
    window.electron.vlc.onEndReached(handleEndReached);
    window.electron.vlc.onError(handleError);

    return () => {
      // Cleanup if needed
    };
  }, [isAvailable, getMediaInfo]);

  return {
    // State
    isAvailable,
    isInitialized,
    playerState,
    time,
    duration,
    volume,
    isMuted,
    audioTracks,
    subtitleTracks,
    currentAudioTrack,
    currentSubtitleTrack,
    error,

    // Unified API
    open,
    playback,
    audio,
    video,
    subtitle,
    window: windowApi,
    getMediaInfo,
    getPlayerInfo,
  };
}
