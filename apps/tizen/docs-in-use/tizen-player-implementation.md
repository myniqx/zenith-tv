# Tizen Player Implementation

## Overview

The `tizenPlayer.ts` store provides a VLC-compatible player interface for Tizen Smart TVs using the AVPlay API. This allows Zenith TV to use the same UI components across Desktop (VLC) and Tizen (AVPlay) platforms.

## Files Created

### 1. Type Definitions
- **`apps/tizen/src/types/tizen.d.ts`** - Complete AVPlay API type definitions
- **`apps/tizen/src/stores/types/player-types.ts`** - VLC-compatible player types

### 2. Store Implementation
- **`apps/tizen/src/stores/tizenPlayer.ts`** - Main Tizen player store
- **`apps/tizen/src/stores/settings.ts`** - Updated with playback preferences

## Feature Parity Matrix

| Feature | VLC Desktop | Tizen AVPlay | Implementation |
|---------|-------------|--------------|----------------|
| **Playback Control** |
| Play/Pause/Stop | ✅ | ✅ | **Fully implemented** |
| Seek (absolute) | ✅ | ✅ | **Fully implemented** via `seekTo()` |
| Seek (relative) | ✅ | ✅ | **Fully implemented** via `jumpForward/Backward()` |
| Playback speed | ✅ | ✅ | **Fully implemented** (limited to preset values) |
| **Audio** |
| Track selection | ✅ | ✅ | **Fully implemented** via `setSelectTrack()` |
| Volume control | ✅ | ❌ | **STUB** - System-level only (TV remote) |
| Mute | ✅ | ⚠️ | **Partial** - Uses disable/enableAudioStream |
| Audio delay | ✅ | ❌ | **STUB** - Not supported by AVPlay |
| **Subtitles** |
| Track selection | ✅ | ✅ | **Fully implemented** via `setSelectTrack()` |
| Subtitle delay | ✅ | ✅ | **Fully implemented** via `setSubtitlePosition()` |
| External subtitles | ✅ | ✅ | **Supported** via `setExternalSubtitlePath()` |
| **Video** |
| Track selection | ✅ | ❌ | **STUB** - AVPlay only supports AUDIO/TEXT |
| Aspect ratio | ✅ | ❌ | **STUB** - No API available |
| Crop | ✅ | ❌ | **STUB** - No API available |
| Scale | ✅ | ❌ | **STUB** - No API available |
| Deinterlace | ✅ | ❌ | **STUB** - Automatic only |
| **Window Management** |
| Fullscreen | ✅ | ✅ | Always fullscreen on Tizen |
| Sticky mode | ✅ | ❌ | **STUB** - No windowing on TV |
| Free mode | ✅ | ❌ | **STUB** - No windowing on TV |
| Window resize | ✅ | ⚠️ | **Partial** - `setDisplayRect()` for video area only |
| **Input** |
| Keyboard shortcuts | ✅ | ❌ | **STUB** - Use D-pad navigation instead |
| **Events** |
| Time updates | ✅ | ✅ | **Fully implemented** via `oncurrentplaytime` |
| State changes | ✅ | ✅ | **Fully implemented** via callbacks |
| Buffering events | ✅ | ✅ | **Fully implemented** (start/progress/complete) |
| Error handling | ✅ | ✅ | **Fully implemented** via `onerror` |
| **Persistence** |
| Watch progress | ✅ | ✅ | **Fully implemented** (auto-save every 10s) |
| Track preferences | ✅ | ✅ | **Fully implemented** (audio/subtitle selection) |
| Auto-resume | ✅ | ✅ | **Fully implemented** |
| Language preferences | ✅ | ✅ | **Fully implemented** |

## Stub Documentation

All stub functions include detailed comments explaining:
1. What parameters they accept
2. Why the feature is not supported
3. What Tizen limitations prevent implementation
4. Suggested alternatives (if any)

### Example Stub Pattern

```typescript
// Unified API: Video control
video: async (options: VideoOptions) => {
  const { isAvailable } = get();
  if (!isAvailable) return;

  // STUB: All video settings
  // Tizen AVPlay does NOT support these video adjustments:
  // - aspectRatio: No API for aspect ratio control
  // - crop: No API for cropping
  // - scale: No API for scaling
  // - deinterlace: No API for deinterlace control

  if (options.aspectRatio !== undefined) {
    console.warn(
      '[Tizen] Aspect ratio control not supported - AVPlay does not provide aspectRatio API. Video displays in native aspect ratio.'
    );
    set({ aspectRatio: options.aspectRatio });
  }

  // ... more stub implementations
}
```

## Usage

### Basic Playback

```typescript
import { useTizenPlayerStore } from './stores/tizenPlayer'

const player = useTizenPlayerStore()

// Initialize player
await player.init()

// Play content
await player.play(watchableObject)

// Control playback
await player.playback({ action: 'pause' })
await player.playback({ time: 120 }) // Seek to 2 minutes

// Select tracks
await player.audio({ track: 1 }) // Select second audio track
await player.subtitle({ track: 0 }) // Select first subtitle track
await player.subtitle({ track: -1 }) // Disable subtitles
```

### Track Management

```typescript
// Get available tracks
const { audioTracks, subtitleTracks } = useTizenPlayerStore()

console.log('Audio tracks:', audioTracks)
// [
//   { id: 0, name: 'ENG (2ch)' },
//   { id: 1, name: 'TUR (2ch)' }
// ]

console.log('Subtitle tracks:', subtitleTracks)
// [
//   { id: 0, name: 'ENG' },
//   { id: 1, name: 'TUR' }
// ]

// Tracks are automatically mapped from Tizen format to VLC format
// Tizen: { type: 'AUDIO', index: 0, extra_info: '{"language":"eng","channels":2}' }
// VLC:   { id: 0, name: 'ENG (2ch)' }
```

### Event Handling

```typescript
// Events are automatically handled via AVPlay listener
// State updates propagate through Zustand store

const { playerState, time, duration, buffering } = useTizenPlayerStore()

// Player state: 'idle' | 'opening' | 'buffering' | 'playing' | 'paused' | 'stopped' | 'ended' | 'error'
// Time: Current position in seconds
// Duration: Total duration in seconds
// Buffering: Buffering progress 0-100 (only during buffering state)
```

### Watch Progress

```typescript
// Progress is automatically saved:
// - Every 10 seconds during playback
// - On pause/stop
// - On stream completion

// Auto-resume from saved position
const watchable = { /* ... */ }
await player.play(watchable) // Automatically resumes from last saved position
```

### Language Preferences

```typescript
import { useSettingsStore } from './stores/settings'

const settings = useSettingsStore()

// Set preferred languages
settings.setPreferredAudioLanguage('eng')
settings.setPreferredSubtitleLanguage('tur')

// These are applied automatically when opening new content
// Priority: Saved tracks > Preferred language > First available track
```

## Tizen-Specific Considerations

### 1. Volume Control
Tizen Smart TVs do not provide application-level volume control API. Volume is controlled at the system level via the TV remote. The `volume` state is maintained for UI consistency but does not affect actual playback volume.

### 2. Screen Modes
Tizen TV apps are always fullscreen. The `screenMode` is always reported as `'fullscreen'`. Sticky mode, free mode, and window positioning features are not available.

### 3. Playback Speed
Tizen supports specific playback speed values: `-16, -8, -4, -2, 1, 2, 4, 8, 16`. When a custom rate is requested, the closest valid rate is selected automatically.

### 4. Track Format Conversion
Tizen's `getTotalTrackInfo()` returns a different format than VLC. The store automatically converts Tizen track info to VLC-compatible format:

**Tizen Format:**
```javascript
{
  type: 'AUDIO',
  index: 0,
  extra_info: '{"language":"eng","channels":2,"codec":"aac"}'
}
```

**VLC Format:**
```javascript
{
  id: 0,
  name: 'ENG (2ch)'
}
```

### 5. D-pad Navigation
Tizen TVs use D-pad remote controls, not keyboard input. Keyboard shortcuts are not supported. Navigation should be implemented using:
- Arrow keys (Up/Down/Left/Right)
- Enter key (OK button)
- Back button
- Focus management

### 6. Error Handling
AVPlay error codes are different from VLC. The store maps common error types to user-friendly messages. Check the console for detailed error information.

## Testing Checklist

When testing the Tizen player:

- [ ] Basic playback (play, pause, stop)
- [ ] Seeking (absolute and relative)
- [ ] Audio track selection
- [ ] Subtitle track selection
- [ ] Subtitle delay adjustment
- [ ] Playback speed control
- [ ] Auto-resume from last position
- [ ] Watch progress auto-save
- [ ] Language preference application
- [ ] Buffering state handling
- [ ] Error handling (invalid URL, network error)
- [ ] Stream completion handling
- [ ] Multi-episode series navigation

## Known Limitations

1. **No application volume control** - Use TV remote
2. **No window management** - Always fullscreen
3. **No keyboard shortcuts** - Use D-pad navigation
4. **No video track selection** - Not supported by AVPlay
5. **No aspect ratio/crop/scale control** - Not supported by AVPlay
6. **No audio delay** - Only subtitle delay available
7. **Limited playback speeds** - Fixed set of values only

## Future Enhancements

Potential improvements:

1. **DRM support** - Implement `ondrmevent` handler for protected content
2. **Advanced buffering** - Fine-tune `setBufferingParam()` for optimal performance
3. **Picture-in-Picture** - Use `setDisplayRect()` for PiP-like experience
4. **External subtitle loading** - Implement subtitle file selection UI
5. **Adaptive bitrate info** - Parse `onevent` callback for quality changes
6. **Network status** - Monitor connection and adjust quality

## Migration from VLC

If you have existing components using VLC player, they should work with Tizen player without modification:

```typescript
// Desktop (VLC)
import { useVlcPlayerStore } from './stores/vlcPlayer'
const player = useVlcPlayerStore()

// Tizen (AVPlay)
import { useTizenPlayerStore } from './stores/tizenPlayer'
const player = useTizenPlayerStore()

// Both have the same interface
await player.init()
await player.play(item)
await player.playback({ action: 'pause' })
```

For platform-specific code, use conditional imports:

```typescript
// Use environment variable or detection
const isDesktop = typeof window.electron !== 'undefined'
const isTizen = typeof window.webapis?.avplay !== 'undefined'

const usePlayerStore = isTizen ? useTizenPlayerStore : useVlcPlayerStore
```
