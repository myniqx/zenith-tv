import { useEffect, useState, useCallback, useRef } from 'react';

// Since nodeIntegration is enabled, we can require the native module directly
const vlcModule = typeof window !== 'undefined' ? (window as any).require?.('../../core/vlc-player') : null;

type VlcState = 'idle' | 'opening' | 'buffering' | 'playing' | 'paused' | 'stopped' | 'ended' | 'error' | 'unknown';

interface VlcTrack {
  id: number;
  name: string;
}

interface VideoFormat {
  width: number;
  height: number;
  pitch: number;
}

/**
 * Hook for using the native VLC player with direct vmem rendering
 */
export function useVlcPlayerDirect() {
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
  const [videoFormat, setVideoFormat] = useState<VideoFormat | null>(null);

  const playerRef = useRef<any>(null);
  const isInitializing = useRef(false);

  // Initialize VLC player
  useEffect(() => {
    const init = async () => {
      if (isInitializing.current) return;
      isInitializing.current = true;

      try {
        if (!vlcModule) {
          console.error('[VLC Direct] Native module not available');
          setIsAvailable(false);
          return;
        }

        if (!vlcModule.isAvailable()) {
          console.error('[VLC Direct] VLC not available on system');
          setIsAvailable(false);
          return;
        }

        setIsAvailable(true);

        // Create player instance
        const player = vlcModule.createPlayer();
        playerRef.current = player;

        // Set up event listeners
        player.on('timeChanged', (newTime: number) => {
          setTime(newTime);
        });

        player.on('stateChanged', (newState: VlcState) => {
          setPlayerState(newState);
          if (newState === 'playing') {
            fetchTracks();
            fetchVideoFormat();
          }
        });

        player.on('endReached', () => {
          setPlayerState('ended');
        });

        player.on('error', (message: string) => {
          setError(message);
          setPlayerState('error');
        });

        setIsInitialized(true);
        console.log('[VLC Direct] Player initialized successfully');
      } catch (err) {
        console.error('[VLC Direct] Initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize');
        setIsAvailable(false);
      }

      isInitializing.current = false;
    };

    init();

    // Cleanup
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.stop();
          playerRef.current.dispose();
        } catch (err) {
          console.error('[VLC Direct] Cleanup error:', err);
        }
      }
    };
  }, []);

  // Fetch video format
  const fetchVideoFormat = useCallback(() => {
    if (!playerRef.current) return;
    try {
      const format = playerRef.current.getVideoFormat();
      if (format && format.width > 0) {
        setVideoFormat(format);
        console.log('[VLC Direct] Video format:', format);
      }
    } catch (err) {
      console.error('[VLC Direct] Failed to get video format:', err);
    }
  }, []);

  // Fetch available tracks
  const fetchTracks = useCallback(async () => {
    if (!playerRef.current) return;

    try {
      const audio = playerRef.current.getAudioTracks();
      const subtitle = playerRef.current.getSubtitleTracks();
      const currentAudio = playerRef.current.getAudioTrack();
      const currentSub = playerRef.current.getSubtitleTrack();
      const len = playerRef.current.getLength();

      setAudioTracks(audio);
      setSubtitleTracks(subtitle);
      setCurrentAudioTrack(currentAudio);
      setCurrentSubtitleTrack(currentSub);
      setDuration(len);
    } catch (err) {
      console.error('[VLC Direct] Failed to fetch tracks:', err);
    }
  }, []);

  // Get current frame
  const getFrame = useCallback((): Buffer | null => {
    if (!playerRef.current) return null;
    try {
      return playerRef.current.getFrame();
    } catch (err) {
      return null;
    }
  }, []);

  // Playback controls
  const play = useCallback(async (url?: string) => {
    if (!playerRef.current) return false;

    setError(null);
    setPlayerState('opening');

    try {
      const result = playerRef.current.play(url);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to play');
      setPlayerState('error');
      return false;
    }
  }, []);

  const pause = useCallback(() => {
    if (!playerRef.current) return;
    playerRef.current.pause();
  }, []);

  const resume = useCallback(() => {
    if (!playerRef.current) return;
    playerRef.current.resume();
  }, []);

  const stop = useCallback(() => {
    if (!playerRef.current) return;
    playerRef.current.stop();
    setTime(0);
    setDuration(0);
    setAudioTracks([]);
    setSubtitleTracks([]);
    setVideoFormat(null);
  }, []);

  const seek = useCallback((timeMs: number) => {
    if (!playerRef.current) return;
    playerRef.current.seek(timeMs);
  }, []);

  const setVolume = useCallback((vol: number) => {
    if (!playerRef.current) return;
    playerRef.current.setVolume(Math.round(vol));
    setVolumeState(vol);
  }, []);

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    const newMuted = !isMuted;
    playerRef.current.setMute(newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

  const setAudioTrack = useCallback((trackId: number) => {
    if (!playerRef.current) return;
    const success = playerRef.current.setAudioTrack(trackId);
    if (success) {
      setCurrentAudioTrack(trackId);
    }
  }, []);

  const setSubtitleTrack = useCallback((trackId: number) => {
    if (!playerRef.current) return;
    const success = playerRef.current.setSubtitleTrack(trackId);
    if (success) {
      setCurrentSubtitleTrack(trackId);
    }
  }, []);

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
    videoFormat,

    // Playback actions
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

    // Frame retrieval
    getFrame,
  };
}
