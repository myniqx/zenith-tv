import { usePlayerStore } from '@zenith-tv/ui/stores/player';
import { useContentStore } from '../stores/content';
import { Button } from '@zenith-tv/ui/button';
import { Slider } from '@zenith-tv/ui/slider';
import { Badge } from '@zenith-tv/ui/badge';
import { Separator } from '@zenith-tv/ui/separator';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
} from 'lucide-react';

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

  const handleSeek = (value: number[]) => {
    const newPosition = value[0];
    seek(newPosition);
    const video = document.querySelector('video');
    if (video) video.currentTime = newPosition;
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
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
              <Badge variant="secondary" className="bg-purple-600 hover:bg-purple-600">
                S{currentItem.category.episode.season.toString().padStart(2, '0')}E{currentItem.category.episode.episode.toString().padStart(2, '0')}
              </Badge>
              <h3 className="text-xl font-semibold text-white truncate">
                {currentItem.category.episode.seriesName}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">{currentItem.title}</p>
          </>
        ) : (
          <>
            <h3 className="text-xl font-semibold text-white truncate">
              {currentItem?.title}
            </h3>
            {currentItem?.group && (
              <p className="text-sm text-muted-foreground">{currentItem.group}</p>
            )}
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <Slider
          value={[position]}
          onValueChange={handleSeek}
          min={0}
          max={duration || 100}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-sm text-muted-foreground mt-1">
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Left controls */}
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePlayPause}
            className="hover:bg-white/10"
          >
            {state === 'playing' ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6" />
            )}
          </Button>

          {/* Skip backward */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleSkip(-10)}
            title="Rewind 10s"
            className="hover:bg-white/10"
          >
            <RotateCcw className="w-5 h-5" />
          </Button>

          {/* Skip forward */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleSkip(10)}
            title="Forward 10s"
            className="hover:bg-white/10"
          >
            <RotateCw className="w-5 h-5" />
          </Button>

          {/* Episode Navigation - Only show for series */}
          {currentItem?.category.type === 'series' && (
            <>
              <Separator orientation="vertical" className="h-8 mx-2" />

              {/* Previous Episode */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePreviousEpisode}
                disabled={!getPreviousEpisode(currentItem)}
                title="Previous Episode"
                className="hover:bg-white/10"
              >
                <SkipBack className="w-5 h-5" />
              </Button>

              {/* Next Episode */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextEpisode}
                disabled={!getNextEpisode(currentItem)}
                title="Next Episode"
                className="hover:bg-white/10"
              >
                <SkipForward className="w-5 h-5" />
              </Button>
            </>
          )}

          {/* Volume */}
          <div className="flex items-center gap-2 ml-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="hover:bg-white/10"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              min={0}
              max={1}
              step={0.01}
              className="w-24"
            />
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFullscreen}
            className="hover:bg-white/10"
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5" />
            ) : (
              <Maximize className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
