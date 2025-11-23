import { useEffect, useState, useCallback, useRef } from 'react';

interface VlcPlayerState {
  isAvailable: boolean;
  isInitialized: boolean;
  state: VlcPlayerState;
  time: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  audioTracks: VlcTrack[];
  subtitleTracks: VlcTrack[];
  currentAudioTrack: number;
  currentSubtitleTrack: number;
  error: string | null;
}

/**
 * Hook for using the native VLC player
 */
export function useVlcPlayer() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [playerState, setPlayerState] = useState<VlcPlayerState>('idle');
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

  // Check VLC availability and initialize
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
      } catch (err) {
        console.error('[VLC] Error checking availability:', err);
        setIsAvailable(false);
      }

      isInitializing.current = false;
    };

    checkAndInit();
  }, []);

  // Set up event listeners
  useEffect(() => {
    if (!isInitialized) return;

    window.electron.vlc.onTimeChanged((newTime) => {
      setTime(newTime);
    });

    window.electron.vlc.onStateChanged((newState) => {
      setPlayerState(newState);

      // Fetch tracks when playback starts
      if (newState === 'playing') {
        fetchTracks();
      }
    });

    window.electron.vlc.onEndReached(() => {
      setPlayerState('ended');
    });

    window.electron.vlc.onError((message) => {
      setError(message);
      setPlayerState('error');
    });
  }, [isInitialized]);

  // Fetch available tracks
  const fetchTracks = useCallback(async () => {
    if (!isInitialized) return;

    try {
      const [audio, subtitle, currentAudio, currentSub, len] = await Promise.all([
        window.electron.vlc.getAudioTracks(),
        window.electron.vlc.getSubtitleTracks(),
        window.electron.vlc.getAudioTrack(),
        window.electron.vlc.getSubtitleTrack(),
        window.electron.vlc.getLength(),
      ]);

      setAudioTracks(audio);
      setSubtitleTracks(subtitle);
      setCurrentAudioTrack(currentAudio);
      setCurrentSubtitleTrack(currentSub);
      setDuration(len);
    } catch (err) {
      console.error('[VLC] Failed to fetch tracks:', err);
    }
  }, [isInitialized]);

  // Playback controls
  const play = useCallback(async (url?: string) => {
    if (!isInitialized) return false;

    setError(null);
    setPlayerState('opening');

    try {
      const result = await window.electron.vlc.play(url);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to play');
      setPlayerState('error');
      return false;
    }
  }, [isInitialized]);

  const pause = useCallback(async () => {
    if (!isInitialized) return;
    await window.electron.vlc.pause();
  }, [isInitialized]);

  const resume = useCallback(async () => {
    if (!isInitialized) return;
    await window.electron.vlc.resume();
  }, [isInitialized]);

  const stop = useCallback(async () => {
    if (!isInitialized) return;
    await window.electron.vlc.stop();
    setTime(0);
    setDuration(0);
    setAudioTracks([]);
    setSubtitleTracks([]);
  }, [isInitialized]);

  const seek = useCallback(async (timeMs: number) => {
    if (!isInitialized) return;
    await window.electron.vlc.seek(timeMs);
  }, [isInitialized]);

  const setVolume = useCallback(async (vol: number) => {
    if (!isInitialized) return;
    await window.electron.vlc.setVolume(Math.round(vol));
    setVolumeState(vol);
  }, [isInitialized]);

  const toggleMute = useCallback(async () => {
    if (!isInitialized) return;
    const newMuted = !isMuted;
    await window.electron.vlc.setMute(newMuted);
    setIsMuted(newMuted);
  }, [isInitialized, isMuted]);

  const setAudioTrack = useCallback(async (trackId: number) => {
    if (!isInitialized) return;
    const success = await window.electron.vlc.setAudioTrack(trackId);
    if (success) {
      setCurrentAudioTrack(trackId);
    }
  }, [isInitialized]);

  const setSubtitleTrack = useCallback(async (trackId: number) => {
    if (!isInitialized) return;
    const success = await window.electron.vlc.setSubtitleTrack(trackId);
    if (success) {
      setCurrentSubtitleTrack(trackId);
    }
  }, [isInitialized]);

  return {
    // State
    isAvailable,
    isInitialized,
    state: playerState,
    time,
    duration,
    volume,
    isMuted,
    audioTracks,
    subtitleTracks,
    currentAudioTrack,
    currentSubtitleTrack,
    error,

    // Actions
    play,
    pause,
    resume,
    stop,
    seek,
    setVolume,
    toggleMute,
    setAudioTrack,
    setSubtitleTrack,
    fetchTracks,
  };
}
