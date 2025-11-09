import { useRef, useState, useEffect } from 'react';
import { usePlayerStore } from '@zenith-tv/ui/src/stores/player';
import { PlayerControls } from './PlayerControls';
import { db } from '../services/database';
import { useContentStore } from '../stores/content';
import { useSettingsStore } from '../stores/settings';

export function VideoPlayer() {
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

  const { getNextEpisode } = useContentStore();
  const { autoPlayNext, defaultVolume, setDefaultVolume } = useSettingsStore();

  // Initialize volume from settings on mount
  useEffect(() => {
    const { setVolume } = usePlayerStore.getState();
    setVolume(defaultVolume);
  }, []); // Empty deps - only run on mount

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

    // Restore track preferences from localStorage
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

    // Reload the video
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

    // Clear any pending retry timeouts
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

      // Auto-play next episode if enabled and available
      if (autoPlayNext && currentItem) {
        const nextEpisode = getNextEpisode(currentItem);
        if (nextEpisode) {
          setTimeout(() => play(nextEpisode), 500); // Small delay for better UX
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

      // Auto-retry with exponential backoff (max 3 attempts)
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
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

    video.src = currentItem.url;
    setState('loading');

    // Load watch history and resume from last position
    const loadWatchHistory = async () => {
      try {
        const history = await db.getWatchHistory(currentItem.url);
        if (history && history.position > 0 && history.position < history.duration - 10) {
          // Resume if not at the beginning or near the end
          video.addEventListener('loadedmetadata', () => {
            video.currentTime = history.position;
          }, { once: true });
        }
      } catch (error) {
        console.error('Failed to load watch history:', error);
      }
    };

    loadWatchHistory();
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

    // Save progress every 10 seconds
    const saveInterval = setInterval(async () => {
      if (video.duration > 0) {
        try {
          await db.saveWatchProgress(currentItem.url, video.currentTime, video.duration);
        } catch (error) {
          console.error('Failed to save watch progress:', error);
        }
      }
    }, 10000);

    // Save on pause
    const handlePause = async () => {
      if (video.duration > 0) {
        try {
          await db.saveWatchProgress(currentItem.url, video.currentTime, video.duration);
        } catch (error) {
          console.error('Failed to save watch progress:', error);
        }
      }
    };

    video.addEventListener('pause', handlePause);

    return () => {
      clearInterval(saveInterval);
      video.removeEventListener('pause', handlePause);

      // Save progress on unmount
      if (video.duration > 0) {
        db.saveWatchProgress(currentItem.url, video.currentTime, video.duration)
          .catch(err => console.error('Failed to save watch progress on unmount:', err));
      }
    };
  }, [currentItem, state]);

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
          <div className="text-6xl mb-4">🎬</div>
          <h3 className="text-2xl font-semibold text-gray-300 mb-2">
            No content selected
          </h3>
          <p className="text-gray-500">
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
      <video
        ref={videoRef}
        className="w-full h-full object-contain cursor-pointer"
        onClick={handleClick}
      />

      {/* Loading spinner */}
      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Buffering spinner */}
      {state === 'buffering' && (
        <div className="absolute top-4 right-4">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error message */}
      {state === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <div className="text-center max-w-lg px-6">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-2xl font-semibold text-red-500 mb-2">
              Playback Error
            </h3>
            <p className="text-gray-400 mb-2">
              {errorMessage || 'Failed to load video stream'}
            </p>

            {retryCount > 0 && retryCount < 3 && (
              <p className="text-sm text-gray-500 mb-4">
                Auto-retrying... (Attempt {retryCount + 1}/3)
              </p>
            )}

            {retryCount >= 3 && (
              <p className="text-sm text-yellow-500 mb-4">
                Maximum retry attempts reached
              </p>
            )}

            <button
              onClick={handleManualRetry}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg
                       transition-colors font-medium mt-4"
            >
              Retry Now
            </button>

            <p className="text-xs text-gray-600 font-mono mt-4 truncate max-w-full">
              {currentItem.url}
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
