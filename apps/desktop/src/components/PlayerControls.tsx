import { usePlayerStore } from '@zenith-tv/ui/src/stores/player';
import { useContentStore } from '../stores/content';

interface PlayerControlsProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function PlayerControls({
  isFullscreen,
  onToggleFullscreen,
}: PlayerControlsProps) {
  const {
    currentItem,
    state,
    position,
    duration,
    volume,
    isMuted,
    seek,
    setVolume,
    toggleMute,
    play,
  } = usePlayerStore();

  const { getNextEpisode, getPreviousEpisode } = useContentStore();

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
    const video = document.querySelector('video');
    if (video) video.currentTime = parseFloat(e.target.value);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const handlePlayPause = () => {
    const video = document.querySelector('video');
    if (video) {
      video.paused ? video.play() : video.pause();
    }
  };

  const handleSkip = (seconds: number) => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    }
  };

  const handlePreviousEpisode = () => {
    if (!currentItem) return;
    const prevEpisode = getPreviousEpisode(currentItem);
    if (prevEpisode) {
      play(prevEpisode);
    }
  };

  const handleNextEpisode = () => {
    if (!currentItem) return;
    const nextEpisode = getNextEpisode(currentItem);
    if (nextEpisode) {
      play(nextEpisode);
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00';
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
      {/* Title */}
      <div className="mb-4">
        {currentItem?.category.type === 'series' ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-purple-600 rounded text-xs font-bold">
                S{currentItem.category.episode.season.toString().padStart(2, '0')}E{currentItem.category.episode.episode.toString().padStart(2, '0')}
              </span>
              <h3 className="text-xl font-semibold text-white truncate">
                {currentItem.category.episode.seriesName}
              </h3>
            </div>
            <p className="text-sm text-gray-400">{currentItem.title}</p>
          </>
        ) : (
          <>
            <h3 className="text-xl font-semibold text-white truncate">
              {currentItem?.title}
            </h3>
            {currentItem?.group && (
              <p className="text-sm text-gray-400">{currentItem.group}</p>
            )}
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={position}
          onChange={handleSeek}
          className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-3
                     [&::-webkit-slider-thumb]:h-3
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-blue-500
                     [&::-webkit-slider-thumb]:cursor-pointer
                     hover:[&::-webkit-slider-thumb]:bg-blue-400"
        />
        <div className="flex justify-between text-sm text-gray-400 mt-1">
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Left controls */}
        <div className="flex items-center gap-4">
          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            {state === 'playing' ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Skip backward */}
          <button
            onClick={() => handleSkip(-10)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            title="Rewind 10s"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
            </svg>
          </button>

          {/* Skip forward */}
          <button
            onClick={() => handleSkip(10)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            title="Forward 10s"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
            </svg>
          </button>

          {/* Episode Navigation - Only show for series */}
          {currentItem?.category.type === 'series' && (
            <>
              {/* Divider */}
              <div className="w-px h-8 bg-gray-600" />

              {/* Previous Episode */}
              <button
                onClick={handlePreviousEpisode}
                disabled={!getPreviousEpisode(currentItem)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous Episode"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>

              {/* Next Episode */}
              <button
                onClick={handleNextEpisode}
                disabled={!getNextEpisode(currentItem)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next Episode"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>
            </>
          )}

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              {isMuted || volume === 0 ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none
                       [&::-webkit-slider-thumb]:w-3
                       [&::-webkit-slider-thumb]:h-3
                       [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-white
                       [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Fullscreen */}
          <button
            onClick={onToggleFullscreen}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            {isFullscreen ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
