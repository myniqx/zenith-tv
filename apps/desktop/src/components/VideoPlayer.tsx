import { useRef, useState, useEffect } from 'react';
import { usePlayerStore } from '@zenith-tv/ui/stores/player';
import { PlayerControls } from './PlayerControls';
import { useContentStore } from '../stores/content';
import { useSettingsStore } from '../stores/settings';
import { Button } from '@zenith-tv/ui/button';
import { Loader2, AlertTriangle, Film } from 'lucide-react';
import { useVlcPlayer } from '../hooks/useVlcPlayer';
import { VlcCanvas } from './VlcCanvas';
import { WatchableObject } from '@/m3u/watchable';

export function VideoPlayer() {
  const { playerBackend } = useSettingsStore();

  // Determine which player to use
  const vlc = useVlcPlayer();
  const shouldUseVlc = playerBackend === 'vlc' ||
    (playerBackend === 'auto' && vlc.isAvailable);

  if (shouldUseVlc && vlc.isAvailable) {
    return <VlcVideoPlayerImpl vlc={vlc} />;
  }

  return <Html5VideoPlayer />;
}

// Player indicator badge
function PlayerBadge({ type }: { type: 'vlc' | 'html5' }) {
  return (
    <div className="absolute top-4 right-4 z-50 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/10">
      <span className="text-xs font-medium text-white/90 flex items-center gap-1.5">
        {type === 'vlc' ? (
          <>
            <Film className="w-3.5 h-3.5" />
            VLC Player
          </>
        ) : (
          <>
            <Film className="w-3.5 h-3.5" />
            HTML5 Player
          </>
        )}
      </span>
    </div>
  );
}

// VLC Player Implementation with vmem canvas rendering
function VlcVideoPlayerImpl({ vlc }: { vlc: ReturnType<typeof useVlcPlayer> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout>(null);

  const {
    currentItem,
    state,
    setState,
    updatePosition,
    updateDuration,
    play: playItem,
  } = usePlayerStore();

  const { getNextEpisode, saveWatchProgress } = useContentStore();
  const { autoPlayNext, defaultVolume } = useSettingsStore();

  // Start playback when item changes
  useEffect(() => {
    if (!vlc.isInitialized || !currentItem) {
      return;
    }

    const startPlayback = async () => {
      console.log('[VLC Direct] Starting playback for:', currentItem.Url);
      setState('loading');

      try {
        await vlc.setVolume(defaultVolume * 100);
        const success = await vlc.play(currentItem.Url);
        console.log('[VLC Direct] Play result:', success);

        if (!success) {
          setState('error');
          return;
        }

        // Handle resume from watch progress
        if (currentItem.userData?.watchProgress && currentItem.userData.watchProgress > 0) {
          const progressPercent = currentItem.userData.watchProgress;
          setTimeout(async () => {
            if (vlc.duration > 0) {
              const position = (progressPercent / 100) * vlc.duration;
              if (position > 0 && position < vlc.duration - 10000) {
                await vlc.seek(position);
              }
            }
          }, 1000);
        }
      } catch (err) {
        console.error('[VLC Direct] Playback error:', err);
        setState('error');
      }
    };

    startPlayback();

    return () => {
      vlc.stop();
    };
  }, [vlc.isInitialized, currentItem?.Url]);

  // Sync VLC state with player store
  useEffect(() => {
    if (!vlc.isInitialized) return;

    const stateMap: Record<string, typeof state> = {
      idle: 'idle',
      opening: 'loading',
      buffering: 'buffering',
      playing: 'playing',
      paused: 'paused',
      stopped: 'idle',
      ended: 'idle',
      error: 'error',
      unknown: 'idle',
    };

    const mappedState = stateMap[vlc.state] || 'idle';
    if (mappedState !== state) {
      setState(mappedState);
    }
  }, [vlc.state, vlc.isInitialized, state, setState]);

  // Sync time updates
  useEffect(() => {
    if (vlc.isInitialized && vlc.time > 0) {
      updatePosition(vlc.time / 1000);
    }
  }, [vlc.time, vlc.isInitialized, updatePosition]);

  // Sync duration
  useEffect(() => {
    if (vlc.isInitialized && vlc.duration > 0) {
      updateDuration(vlc.duration / 1000);
    }
  }, [vlc.duration, vlc.isInitialized, updateDuration]);

  // Handle end of playback
  useEffect(() => {
    if (vlc.state === 'ended' && autoPlayNext && currentItem) {
      const nextEpisode = getNextEpisode(currentItem);
      if (nextEpisode) {
        setTimeout(() => playItem(nextEpisode), 500);
      }
    }
  }, [vlc.state, autoPlayNext, currentItem, getNextEpisode, playItem]);

  // Auto-save watch progress
  useEffect(() => {
    if (!vlc.isInitialized || !currentItem || vlc.state !== 'playing') return;

    const saveInterval = setInterval(async () => {
      if (vlc.duration > 0) {
        try {
          await saveWatchProgress(
            currentItem as WatchableObject,
            vlc.time / 1000,
            vlc.duration / 1000
          );
        } catch (error) {
          console.error('Failed to save watch progress:', error);
        }
      }
    }, 10000);

    return () => {
      clearInterval(saveInterval);
      if (vlc.duration > 0) {
        saveWatchProgress(currentItem as WatchableObject, vlc.time / 1000, vlc.duration / 1000)
          .catch(err => console.error('Failed to save watch progress on unmount:', err));
      }
    };
  }, [currentItem, vlc.state, vlc.time, vlc.duration, vlc.isInitialized, saveWatchProgress]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls && vlc.state === 'playing') {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }

    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, [showControls, vlc.state]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!vlc.isInitialized) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (vlc.state === 'playing') {
            await vlc.pause();
          } else if (vlc.state === 'paused') {
            await vlc.resume();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          await vlc.seek(Math.max(0, vlc.time - 10000));
          break;
        case 'ArrowRight':
          e.preventDefault();
          await vlc.seek(Math.min(vlc.duration, vlc.time + 10000));
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          await vlc.toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vlc]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
  };

  const handleClick = async () => {
    if (!vlc.isInitialized) return;

    if (vlc.state === 'playing') {
      await vlc.pause();
    } else if (vlc.state === 'paused') {
      await vlc.resume();
    }
  };

  const handleRetry = async () => {
    if (!currentItem) return;
    await vlc.stop();
    await vlc.play(currentItem.Url);
  };

  // No content selected
  if (!currentItem) {
    return (
      <div className="flex items-center justify-center h-full bg-black/90">
        <div className="text-center">
          <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-2xl font-semibold text-muted-foreground mb-2">
            No content selected
          </h3>
          <p className="text-muted-foreground/60">
            Select something to watch from your library
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black group"
      onMouseMove={handleMouseMove}
    >
      {/* Player badge */}
      <PlayerBadge type="vlc" />

      {/* Video canvas - VLC renders frames here */}
      <div className="absolute inset-0 z-0" onClick={handleClick}>
        <VlcCanvas
          getFrame={vlc.getFrame}
          videoFormat={vlc.videoFormat}
          className="w-full h-full"
        />
      </div>

      {/* Overlay container */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Loading spinner */}
        {(vlc.state === 'opening' || vlc.state === 'buffering' || state === 'loading') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
          </div>
        )}

        {/* Error message */}
        {vlc.state === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 pointer-events-auto">
            <div className="text-center max-w-lg px-6">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
              <h3 className="text-2xl font-semibold text-destructive mb-2">
                Playback Error
              </h3>
              <p className="text-muted-foreground mb-4">
                {vlc.error || 'Failed to play video stream'}
              </p>

              <Button onClick={handleRetry}>
                Retry
              </Button>

              <p className="text-xs text-muted-foreground/50 font-mono mt-4 truncate max-w-full">
                {currentItem.Url}
              </p>
            </div>
          </div>
        )}

        {/* Track info overlay */}
        {vlc.state === 'playing' && vlc.audioTracks.length > 0 && showControls && (
          <div className="absolute top-4 right-4 bg-black/70 rounded-lg px-3 py-2 text-sm pointer-events-auto">
            <div className="text-white/60">
              Audio: {vlc.audioTracks.find((t: any) => t.id === vlc.currentAudioTrack)?.name || 'Default'}
            </div>
            {vlc.subtitleTracks.length > 0 && (
              <div className="text-white/60">
                Subtitle: {vlc.subtitleTracks.find((t: any) => t.id === vlc.currentSubtitleTrack)?.name || 'Off'}
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        {showControls && currentItem && (
          <div className="pointer-events-auto">
            <PlayerControls
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
            />
          </div>
        )}
      </div>
    </div >
  );
}

// HTML5 Video Player Implementation
function Html5VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout>();
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  const {
    currentItem,
    state,
    position,
    volume,
    isMuted,
    setState,
    updatePosition,
    updateDuration,
    play,
  } = usePlayerStore();

  const { getNextEpisode, saveWatchProgress } = useContentStore();
  const { autoPlayNext, defaultVolume, setDefaultVolume, bufferSize } = useSettingsStore();

  // Initialize volume from settings on mount
  useEffect(() => {
    const { setVolume } = usePlayerStore.getState();
    setVolume(defaultVolume);
  }, []);

  // Save volume changes to settings
  useEffect(() => {
    if (volume !== defaultVolume) {
      setDefaultVolume(volume);
    }
  }, [volume, defaultVolume, setDefaultVolume]);

  // Save/restore track preferences
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentItem) return;

    const savedTracks = localStorage.getItem('zenith-track-preferences');
    if (savedTracks) {
      try {
        const { audioTrack, subtitleTrack } = JSON.parse(savedTracks);
        if (audioTrack !== undefined) {
          usePlayerStore.getState().setAudioTrack(audioTrack);
        }
        if (subtitleTrack !== undefined) {
          usePlayerStore.getState().setSubtitleTrack(subtitleTrack);
        }
      } catch (e) {
        console.error('Failed to restore track preferences:', e);
      }
    }
  }, [currentItem]);

  // Retry stream function
  const retryStream = () => {
    const video = videoRef.current;
    if (!video || !currentItem) return;

    setRetryCount((prev) => prev + 1);
    setErrorMessage('');
    setState('loading');

    video.load();
    video.play().catch((err) => {
      console.error('Retry failed:', err);
    });
  };

  // Manual retry (reset count)
  const handleManualRetry = () => {
    setRetryCount(0);
    retryStream();
  };

  // Reset retry count when item changes
  useEffect(() => {
    setRetryCount(0);
    setErrorMessage('');

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [currentItem]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      updateDuration(video.duration);
      setState('playing');
      video.play();
    };

    const handleTimeUpdate = () => {
      updatePosition(video.currentTime);
    };

    const handlePlay = () => setState('playing');
    const handlePause = () => setState('paused');
    const handleWaiting = () => setState('buffering');
    const handleCanPlay = () => {
      if (state === 'buffering') setState('playing');
    };
    const handleEnded = () => {
      setState('idle');

      if (autoPlayNext && currentItem) {
        const nextEpisode = getNextEpisode(currentItem);
        if (nextEpisode) {
          setTimeout(() => play(nextEpisode), 500);
        }
      }
    };
    const handleError = (e: Event) => {
      const mediaError = video.error;
      let message = 'Failed to load stream';

      if (mediaError) {
        switch (mediaError.code) {
          case mediaError.MEDIA_ERR_ABORTED:
            message = 'Stream loading aborted';
            break;
          case mediaError.MEDIA_ERR_NETWORK:
            message = 'Network error - check your connection';
            break;
          case mediaError.MEDIA_ERR_DECODE:
            message = 'Stream format not supported';
            break;
          case mediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            message = 'Stream source not available';
            break;
        }
      }

      setErrorMessage(message);
      setState('error');

      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        retryTimeoutRef.current = setTimeout(() => {
          retryStream();
        }, delay);
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [state, setState, updatePosition, updateDuration, autoPlayNext, currentItem, getNextEpisode, play, retryCount]);

  // Update video source when currentItem changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentItem) return;

    video.src = currentItem.Url;
    setState('loading');

    if (currentItem.userData?.watchProgress && currentItem.userData.watchProgress > 0) {
      const progressPercent = currentItem.userData.watchProgress;

      video.addEventListener('loadedmetadata', () => {
        const position = (progressPercent / 100) * video.duration;

        if (position > 0 && position < video.duration - 10) {
          video.currentTime = position;
        }
      }, { once: true });
    }
  }, [currentItem, setState]);

  // Update video volume and mute
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  // Auto-save watch progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentItem || state !== 'playing') return;

    const saveInterval = setInterval(async () => {
      if (video.duration > 0) {
        try {
          await saveWatchProgress(currentItem, video.currentTime, video.duration);
        } catch (error) {
          console.error('Failed to save watch progress:', error);
        }
      }
    }, 10000);

    const handlePause = async () => {
      if (video.duration > 0) {
        try {
          await saveWatchProgress(currentItem, video.currentTime, video.duration);
        } catch (error) {
          console.error('Failed to save watch progress:', error);
        }
      }
    };

    video.addEventListener('pause', handlePause);

    return () => {
      clearInterval(saveInterval);
      video.removeEventListener('pause', handlePause);

      if (video.duration > 0) {
        saveWatchProgress(currentItem, video.currentTime, video.duration)
          .catch(err => console.error('Failed to save watch progress on unmount:', err));
      }
    };
  }, [currentItem, state, saveWatchProgress]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls && state === 'playing') {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }

      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }

    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, [showControls, state]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          usePlayerStore.getState().toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
  };

  const handleClick = () => {
    const video = videoRef.current;
    if (video) {
      video.paused ? video.play() : video.pause();
    }
  };

  if (!currentItem) {
    return (
      <div className="flex items-center justify-center h-full bg-black/90">
        <div className="text-center">
          <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-2xl font-semibold text-muted-foreground mb-2">
            No content selected
          </h3>
          <p className="text-muted-foreground/60">
            Select something to watch from your library
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black group"
      onMouseMove={handleMouseMove}
    >
      {/* Player badge */}
      <PlayerBadge type="html5" />

      <video
        ref={videoRef}
        className="w-full h-full object-contain cursor-pointer"
        onClick={handleClick}
        preload={bufferSize >= 15 ? 'auto' : 'metadata'}
      />

      {/* Loading spinner */}
      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="w-16 h-16 text-primary animate-spin" />
        </div>
      )}

      {/* Buffering spinner */}
      {state === 'buffering' && (
        <div className="absolute top-4 right-4">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      )}

      {/* Error message */}
      {state === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <div className="text-center max-w-lg px-6">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h3 className="text-2xl font-semibold text-destructive mb-2">
              Playback Error
            </h3>
            <p className="text-muted-foreground mb-2">
              {errorMessage || 'Failed to load video stream'}
            </p>

            {retryCount > 0 && retryCount < 3 && (
              <p className="text-sm text-muted-foreground mb-4">
                Auto-retrying... (Attempt {retryCount + 1}/3)
              </p>
            )}

            {retryCount >= 3 && (
              <p className="text-sm text-yellow-500 mb-4">
                Maximum retry attempts reached
              </p>
            )}

            <Button onClick={handleManualRetry} className="mt-4">
              Retry Now
            </Button>

            <p className="text-xs text-muted-foreground/50 font-mono mt-4 truncate max-w-full">
              {currentItem.Url}
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      {showControls && currentItem && (
        <PlayerControls
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      )}
    </div>
  );
}
