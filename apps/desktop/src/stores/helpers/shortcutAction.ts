import { ShortcutAction, UseVlcPlayerReturn } from "@/types/types";


export const shortcutActions = (state: UseVlcPlayerReturn, action: ShortcutAction) => {
  // Execute action based on shortcut
  switch (action) {
    case 'playPause':
      if (state.playerState === 'playing') {
        state.playback({ action: 'pause' });
      } else {
        state.playback({ action: 'resume' });
      }
      break;

    case 'stop':
      state.playback({ action: 'stop' });
      break;

    case 'seekForward':
      state.playback({ time: Math.min(state.time + 10000, state.duration) });
      break;

    case 'seekBackward':
      state.playback({ time: Math.max(state.time - 10000, 0) });
      break;

    case 'seekForwardSmall':
      state.playback({ time: Math.min(state.time + 3000, state.duration) });
      break;

    case 'seekBackwardSmall':
      state.playback({ time: Math.max(state.time - 3000, 0) });
      break;

    case 'volumeUp':
      state.audio({ volume: Math.min(state.volume + 5, 100) });
      break;

    case 'volumeDown':
      state.audio({ volume: Math.max(state.volume - 5, 0) });
      break;

    case 'toggleMute':
      state.audio({ mute: !state.isMuted });
      break;

    case 'toggleFullscreen':
      const newMode = state.screenMode === 'fullscreen' ? 'free' : 'fullscreen';
      state.setScreenMode(newMode);
      break;

    case 'exitFullscreen':
      state.setScreenMode('free');
      break;

    case 'stickyMode':
      state.setScreenMode('sticky');
      break;

    case 'freeScreenMode':
      state.setScreenMode('free');
      break;

    case 'subtitleDelayPlus':
      // Add 100ms (100000 microseconds) to current delay
      state.subtitle({ delay: state.subtitleDelay + 100000 });
      break;

    case 'subtitleDelayMinus':
      // Subtract 100ms (100000 microseconds) from current delay
      state.subtitle({ delay: state.subtitleDelay - 100000 });
      break;

    case 'subtitleDisable':
      state.subtitle({ track: -1 }); // -1 disables subtitles
      break;

    default:
      console.warn('[VLC] Unknown shortcut action:', action);
  }
}
