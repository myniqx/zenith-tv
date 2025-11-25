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

interface VideoFrame {
  frameBuffer: ArrayBuffer;
  width: number;
  height: number;
  timestamp: number;
}

interface FrameStats {
  receivedFrames: number;
  droppedFrames: number;
  currentFPS: number;
  lastFrameTime: number;
}

/**
 * Optimized hook for VLC player with MessagePort frame transfer
 * Supports both window mode (child window) and canvas mode (MessagePort frames)
 */
export function useVlcPlayerOptimized() {
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
  const [videoFormat, setVideoFormat] = useState<{ width: number; height: number } | null>(null);
  const [frameStats, setFrameStats] = useState<FrameStats>({
    receivedFrames: 0,
    droppedFrames: 0,
    currentFPS: 0,
    lastFrameTime: 0
  });

  const isInitializing = useRef(false);
  const lastBounds = useRef<Bounds | null>(null);
  const framePort = useRef<MessagePort | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameCallback = useRef<((frame: VideoFrame) => void) | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const frameTimestamps = useRef<number[]>([]);
  const statsUpdateInterval = useRef<number | null>(null);

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

            // Store frame port if provided
            if (result.framePort) {
              framePort.current = result.framePort;
              setupFramePort(result.framePort);
            }

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

    // Cleanup on unmount
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (statsUpdateInterval.current) {
        clearInterval(statsUpdateInterval.current);
      }
      if (framePort.current) {
        framePort.current.close();
      }
    };
  }, []);

  // Setup MessagePort for frame transfer
  const setupFramePort = (port: MessagePort) => {
    port.onmessage = (event) => {
      const frame = event.data as VideoFrame;

      // Update frame statistics
      const now = performance.now();
      frameTimestamps.current.push(now);

      // Keep only last 60 frames for FPS calculation
      if (frameTimestamps.current.length > 60) {
        frameTimestamps.current.shift();
      }

      // Update video format if changed
      if (!videoFormat || videoFormat.width !== frame.width || videoFormat.height !== frame.height) {
        setVideoFormat({ width: frame.width, height: frame.height });
      }

      // Call frame callback if set
      if (frameCallback.current) {
        frameCallback.current(frame);
      }

      // Auto-render to canvas if canvas ref is set
      if (canvasRef.current) {
        renderFrameToCanvas(frame);
      }

      setFrameStats(prev => ({
        ...prev,
        receivedFrames: prev.receivedFrames + 1,
        lastFrameTime: now
      }));
    };

    // Start FPS calculation interval
    statsUpdateInterval.current = window.setInterval(() => {
      if (frameTimestamps.current.length >= 2) {
        const duration = frameTimestamps.current[frameTimestamps.current.length - 1] - frameTimestamps.current[0];
        const fps = (frameTimestamps.current.length / duration) * 1000;
        setFrameStats(prev => ({ ...prev, currentFPS: Math.round(fps) }));
      }
    }, 1000);
  };

  // Render frame to canvas
  const renderFrameToCanvas = (frame: VideoFrame) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Resize canvas if needed
    if (canvas.width !== frame.width || canvas.height !== frame.height) {
      canvas.width = frame.width;
      canvas.height = frame.height;
    }

    try {
      // Create ImageData from frame buffer
      const imageData = new ImageData(
        new Uint8ClampedArray(frame.frameBuffer),
        frame.width,
        frame.height
      );

      // Draw to canvas
      ctx.putImageData(imageData, 0, 0);
    } catch (err) {
      console.error('[VLC] Failed to render frame:', err);
      setFrameStats(prev => ({
        ...prev,
        droppedFrames: prev.droppedFrames + 1
      }));
    }
  };

  // Set canvas reference for auto-rendering
  const setCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
  }, []);

  // Set custom frame callback
  const setFrameCallback = useCallback((callback: ((frame: VideoFrame) => void) | null) => {
    frameCallback.current = callback;
  }, []);

  // Setup video callback (canvas mode)
  const setupVideoCallback = useCallback(async (width: number, height: number) => {
    if (!isInitialized) return false;

    try {
      const result = await window.electron.vlc.setupVideoCallback(width, height);
      if (result.success) {
        console.log('[VLC] Video callback setup successfully:', { width, height });
        return true;
      } else {
        console.error('[VLC] Failed to setup video callback:', result.error);
        return false;
      }
    } catch (err) {
      console.error('[VLC] Error setting up video callback:', err);
      return false;
    }
  }, [isInitialized]);

  // Set up event listeners
  useEffect(() => {
    if (!isInitialized) return;

    const timeChangedHandler = window.electron.vlc.onTimeChanged((newTime) => {
      setTime(newTime);
    });

    const stateChangedHandler = window.electron.vlc.onStateChanged((newState) => {
      setPlayerState(newState);

      // Fetch tracks when playback starts
      if (newState === 'playing') {
        fetchTracks();
      }
    });

    const endReachedHandler = window.electron.vlc.onEndReached(() => {
      setPlayerState('ended');
    });

    const errorHandler = window.electron.vlc.onError((message) => {
      setError(message);
      setPlayerState('error');
    });

    // Cleanup not needed as Electron IPC listeners don't return unsubscribe functions
    return () => {
      // Event listeners are automatically cleaned up by Electron
    };
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

    // Reset frame stats
    setFrameStats({
      receivedFrames: 0,
      droppedFrames: 0,
      currentFPS: 0,
      lastFrameTime: 0
    });
    frameTimestamps.current = [];

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
    setVideoFormat(null);
    frameTimestamps.current = [];
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

  // Child window management (window mode)
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
    videoFormat,
    frameStats,

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

    // Child window actions (window mode)
    createChildWindow,
    destroyChildWindow,
    setBounds,
    showWindow,
    hideWindow,

    // Canvas mode actions
    setupVideoCallback,
    setCanvasRef,
    setFrameCallback,
  };
}
