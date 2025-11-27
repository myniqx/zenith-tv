import { useEffect, useState, useCallback, useRef } from 'react';

type VlcState = 'idle' | 'opening' | 'buffering' | 'playing' | 'paused' | 'stopped' | 'ended' | 'error' | 'unknown';

interface VlcTrack {
  id: number;
  name: string;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Hook for using the native VLC player with child window embedding
 */
export function useVlcPlayer() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isChildWindowCreated, setIsChildWindowCreated] = useState(false);
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
  const lastBounds = useRef<Bounds | null>(null);

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

  // Child window management
  const createChildWindow = useCallback(async (bounds: Bounds) => {
    if (!isInitialized) return false;

    try {
      const result = await window.electron.vlc.createChildWindow(
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height
      );

      if (result.success) {
        setIsChildWindowCreated(true);
        lastBounds.current = bounds;
        console.log('[VLC] Child window created at:', bounds);
        return true;
      } else {
        console.error('[VLC] Failed to create child window:', result.error);
        return false;
      }
    } catch (err) {
      console.error('[VLC] Error creating child window:', err);
      return false;
    }
  }, [isInitialized]);

  const destroyChildWindow = useCallback(async () => {
    if (!isInitialized) return false;

    try {
      const result = await window.electron.vlc.destroyChildWindow();
      if (result.success) {
        setIsChildWindowCreated(false);
        lastBounds.current = null;
        console.log('[VLC] Child window destroyed');
      }
      return result.success;
    } catch (err) {
      console.error('[VLC] Error destroying child window:', err);
      return false;
    }
  }, [isInitialized]);

  const setBounds = useCallback(async (bounds: Bounds) => {
    if (!isInitialized || !isChildWindowCreated) return false;

    // Skip if bounds haven't changed
    if (lastBounds.current &&
        lastBounds.current.x === bounds.x &&
        lastBounds.current.y === bounds.y &&
        lastBounds.current.width === bounds.width &&
        lastBounds.current.height === bounds.height) {
      return true;
    }

    try {
      const result = await window.electron.vlc.setBounds(
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height
      );

      if (result) {
        lastBounds.current = bounds;
      }
      return result;
    } catch (err) {
      console.error('[VLC] Error setting bounds:', err);
      return false;
    }
  }, [isInitialized, isChildWindowCreated]);

  const showWindow = useCallback(async () => {
    if (!isInitialized || !isChildWindowCreated) return false;

    try {
      return await window.electron.vlc.showWindow();
    } catch (err) {
      console.error('[VLC] Error showing window:', err);
      return false;
    }
  }, [isInitialized, isChildWindowCreated]);

  const hideWindow = useCallback(async () => {
    if (!isInitialized || !isChildWindowCreated) return false;

    try {
      return await window.electron.vlc.hideWindow();
    } catch (err) {
      console.error('[VLC] Error hiding window:', err);
      return false;
    }
  }, [isInitialized, isChildWindowCreated]);

  return {
    // State
    isAvailable,
    isInitialized,
    isChildWindowCreated,
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

    // Child window actions
    createChildWindow,
    destroyChildWindow,
    setBounds,
    showWindow,
    hideWindow,
  };
}
