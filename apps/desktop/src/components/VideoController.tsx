import { useEffect } from 'react';
import { usePlayerStore } from '@zenith-tv/ui/stores/player';
import { useContentStore } from '../stores/content';
import { useSettingsStore } from '../stores/settings';
import { useUniversalPlayerStore } from '../stores/universalPlayerStore';
import { Button } from '@zenith-tv/ui/button';
import { Slider } from '@zenith-tv/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zenith-tv/ui/select';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Monitor,
  Languages,
  Subtitles,
  StickyNote,
  Maximize,
  Square,
  Layers,
} from 'lucide-react';
import { TvShowWatchableObject, WatchableObject } from '../m3u/watchable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@zenith-tv/ui/dialog';
import { VideoSettings } from './Settings';
import { Settings as SettingsIcon } from 'lucide-react';

type ScreenType = 'free' | 'free_ontop' | 'sticky' | 'fullscreen';


export function VideoController() {
  const { defaultVolume, autoPlayNext, keyboardShortcuts } = useSettingsStore();
  const {
    currentItem,
    state,
    setState,
    updatePosition,
    updateDuration,
    play: playItem,
    setVolume: setStoreVolume,
  } = usePlayerStore();

  const { getNextEpisode } = useContentStore();

  // Initialize Universal Player store on mount
  const vlc = useUniversalPlayerStore();

  useEffect(() => {
    vlc.init();
  }, []);




  // Setup keyboard shortcuts for VLC native window
  useEffect(() => {
    if (!vlc.isAvailable) return;

    // Map settings shortcuts to VLC format: { "Space": "playPause", "Escape": "exitFullscreen" }
    const vlcShortcuts: Record<string, string[]> = {};

    Object.entries(keyboardShortcuts).forEach(([action, keyCombos]) => {
      // Convert "ctrl+KeyF" to just "KeyF" for VLC (modifiers not supported in native yet)
      const comboArray = Array.isArray(keyCombos) ? keyCombos : [keyCombos];
      const cleanKeys = comboArray.map(keyCombo => keyCombo.split('+').pop() || keyCombo);
      vlcShortcuts[action] = cleanKeys;
    });

    vlc.shortcut({ shortcuts: vlcShortcuts as Record<any, string[]> }).catch(err => {
      console.error('[VLC] Failed to setup shortcuts:', err);
    });
  }, [vlc.isAvailable, keyboardShortcuts, vlc]);

  // Initialize VLC and Window Management
  useEffect(() => {
    if (!vlc.isAvailable || !currentItem) return;

    const setupAndPlay = async () => {
      // Start Playback
      try {
        await vlc.open(currentItem.Url);
        await vlc.audio({ volume: defaultVolume * 100, mute: vlc.isMuted });
        await vlc.playback({ action: 'play' });

        // Resume logic
        if (currentItem.userData?.watchProgress && currentItem.userData.watchProgress > 0) {
          setTimeout(async () => {
            if (vlc.duration > 0) {
              const pos = ((currentItem.userData?.watchProgress || 0) / 100) * vlc.duration;
              await vlc.playback({ time: pos });
            }
          }, 1000);
        }

      } catch (err) {
        console.error('Playback error:', err);
        setState('error');
      }
    };

    setupAndPlay();
  }, [vlc.isAvailable, currentItem?.Url, defaultVolume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vlc.isAvailable) {
        vlc.playback({ action: 'stop' }).catch(() => {
          // Ignore errors on cleanup
        });
      }
    };

  }, []);

  // Sync State
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
    const mapped = stateMap[vlc.playerState] || 'idle';
    if (mapped !== state) setState(mapped);
  }, [vlc.playerState, state, setState]);

  // Sync Time & Duration
  useEffect(() => {
    if (vlc.isInitialized) {
      if (vlc.time > 0) updatePosition(vlc.time / 1000);
      if (vlc.duration > 0) updateDuration(vlc.duration / 1000);
    }
  }, [vlc.time, vlc.duration, updatePosition, updateDuration]);

  // Auto Play Next
  useEffect(() => {
    if (vlc.playerState === 'ended' && autoPlayNext && currentItem) {
      const next = getNextEpisode(currentItem as WatchableObject);
      if (next) setTimeout(() => playItem(next), 500);
    }
  }, [vlc.playerState, autoPlayNext, currentItem, getNextEpisode, playItem]);



  // Handlers
  const handlePlayPause = async () => {
    if (vlc.playerState === 'playing') {
      await vlc.playback({ action: 'pause' });
    } else if (vlc.playerState === 'stopped' || vlc.playerState === 'ended' || vlc.playerState === 'idle') {
      // If stopped/ended/idle, need to re-open and play
      if (currentItem) {
        await vlc.open(currentItem.Url);
        await vlc.playback({ action: 'play' });
      }
    } else {
      // Paused state - just resume
      await vlc.playback({ action: 'resume' });
    }
  };

  const handleStop = async () => {
    await vlc.playback({ action: 'stop' });
    setState('idle');
  };

  const handleSeek = async (vals: number[]) => {
    await vlc.playback({ time: vals[0] * 1000 });
  };

  const handleVolume = async (vals: number[]) => {
    const vol = vals[0];
    setStoreVolume(vol / 100);
    await vlc.audio({ volume: vol });
  };

  const toggleMute = async () => {
    await vlc.audio({ mute: !vlc.isMuted });
  };

  const handleScreenTypeChange = (type: ScreenType) => {
    vlc.setScreenMode(type);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const modifiers: string[] = [];
      if (e.ctrlKey) modifiers.push('ctrl');
      if (e.altKey) modifiers.push('alt');
      if (e.shiftKey) modifiers.push('shift');
      if (e.metaKey) modifiers.push('meta');

      const key = e.code;
      const fullKey = [...modifiers, key].join('+');

      if (keyboardShortcuts.playPause.includes(fullKey)) {
        handlePlayPause();
      } else if (keyboardShortcuts.seekForward.includes(fullKey)) {
        const newTime = Math.min(vlc.time + 10000, vlc.duration);
        vlc.playback({ time: newTime });
      } else if (keyboardShortcuts.seekBackward.includes(fullKey)) {
        const newTime = Math.max(vlc.time - 10000, 0);
        vlc.playback({ time: newTime });
      } else if (keyboardShortcuts.seekForwardSmall.includes(fullKey)) {
        const newTime = Math.min(vlc.time + 3000, vlc.duration);
        vlc.playback({ time: newTime });
      } else if (keyboardShortcuts.seekBackwardSmall.includes(fullKey)) {
        const newTime = Math.max(vlc.time - 3000, 0);
        vlc.playback({ time: newTime });
      } else if (keyboardShortcuts.volumeUp.includes(fullKey)) {
        const newVol = Math.min(vlc.volume + 5, 100);
        setStoreVolume(newVol / 100);
        vlc.audio({ volume: newVol });
      } else if (keyboardShortcuts.volumeDown.includes(fullKey)) {
        const newVol = Math.max(vlc.volume - 5, 0);
        setStoreVolume(newVol / 100);
        vlc.audio({ volume: newVol });
      } else if (keyboardShortcuts.toggleMute.includes(fullKey)) {
        toggleMute();
      } else if (keyboardShortcuts.toggleFullscreen.includes(fullKey)) {
        vlc.setScreenMode(vlc.screenMode === 'fullscreen' ? 'free' : 'fullscreen');
      } else if (keyboardShortcuts.exitFullscreen.includes(fullKey)) {
        vlc.setScreenMode('free');
      }
      else {
        return;
      }

      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    keyboardShortcuts,
    vlc,
    setStoreVolume,
    handlePlayPause,
    toggleMute,
  ]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isDisabled = vlc.playerState === 'stopped';
  const hasItem = !!currentItem;

  // Helper to get episode info safely
  const getEpisodeInfo = () => {
    if (!currentItem || currentItem.category !== 'Series') return null;
    // Cast to TvShowWatchableObject to access Season/Episode
    // We assume currentItem is compatible if category is Series
    const tvItem = currentItem as unknown as TvShowWatchableObject;
    if (tvItem.Season !== undefined && tvItem.Episode !== undefined) {
      return `S${tvItem.Season}E${tvItem.Episode}`;
    }
    return null;
  };

  return (
    <div className={`w-full bg-black border-t border-border p-4 ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex flex-col gap-2 max-w-screen-2xl mx-auto">

        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-12 text-right">{formatTime(vlc.time)}</span>
          <Slider
            value={[vlc.time / 1000]}
            max={vlc.duration / 1000 || 100}
            step={1}
            onValueChange={handleSeek}
            className="flex-1"
            disabled={isDisabled}
          />
          <span className="text-xs text-muted-foreground w-12">{formatTime(vlc.duration)}</span>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between">

          {/* Left: Playback & Volume */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handlePlayPause} disabled={!hasItem}>
              {vlc.playerState === 'playing' ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>

            <Button variant="ghost" size="icon" onClick={handleStop} disabled={!hasItem}>
              <Square className="h-5 w-5 fill-current" />
            </Button>

            <div className="flex items-center gap-2 group">
              <Button variant="ghost" size="icon" onClick={toggleMute} disabled={!hasItem}>
                {vlc.isMuted || vlc.volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              <div className="w-0 overflow-hidden group-hover:w-24 transition-all duration-300">
                <Slider
                  value={[vlc.isMuted ? 0 : vlc.volume]}
                  max={100}
                  step={1}
                  onValueChange={handleVolume}
                  className="w-24"
                  disabled={isDisabled}
                />
              </div>
            </div>

            {currentItem && (
              <div className="flex flex-col ml-2">
                <span className="text-sm font-medium truncate max-w-[200px]">{currentItem.Name}</span>
                {currentItem.category === 'Series' && (
                  <span className="text-xs text-muted-foreground">
                    {getEpisodeInfo()}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: Tracks & Screen Mode */}
          <div className="flex items-center gap-2">

            {/* Audio Tracks */}
            <Select
              value={vlc.currentAudioTrack.toString()}
              onValueChange={(val) => vlc.audio({ track: parseInt(val) })}
              disabled={isDisabled || vlc.audioTracks.length === 0}
            >
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <Languages className="h-3 w-3 mr-2" />
                <SelectValue placeholder="Audio" />
              </SelectTrigger>
              <SelectContent>
                {vlc.audioTracks.map((track) => (
                  <SelectItem key={track.id} value={track.id.toString()}>
                    {track.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Subtitle Tracks */}
            <Select
              value={vlc.currentSubtitleTrack.toString()}
              onValueChange={(val) => vlc.subtitle({ track: parseInt(val) })}
              disabled={isDisabled}
            >
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <Subtitles className="h-3 w-3 mr-2" />
                <SelectValue placeholder="Subtitles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-1">Off</SelectItem>
                {vlc.subtitleTracks.map((track) => (
                  <SelectItem key={track.id} value={track.id.toString()}>
                    {track.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-6 w-px bg-border mx-2" />

            {/* Screen Mode */}
            {/* Screen Mode Grid */}
            <div className="grid grid-cols-2 gap-px bg-border rounded overflow-hidden border border-border">
              {[
                { mode: 'free', icon: Monitor, title: 'Free' },
                { mode: 'free_ontop', icon: Layers, title: 'Always on Top' },
                { mode: 'sticky', icon: StickyNote, title: 'Sticky' },
                { mode: 'fullscreen', icon: Maximize, title: 'Fullscreen' },
              ].map(({ mode, icon: Icon, title }) => (
                <Button
                  key={mode}
                  variant={vlc.screenMode === mode ? 'outline' : 'ghost'}
                  size="icon"
                  className={`h-5 w-5 rounded-none p-3 ${vlc.screenMode === mode ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
                  onClick={() => handleScreenTypeChange(mode as ScreenType)}
                  title={title}
                  disabled={isDisabled}
                >
                  <Icon className="h-full w-full" />
                </Button>
              ))}
            </div>

            <div className="h-6 w-px bg-border mx-2" />

            {/* Settings Modal */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isDisabled}>
                  <SettingsIcon className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Video Settings</DialogTitle>
                </DialogHeader>
                <VideoSettings />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
