# AVPlay API Reference for Zenith TV

This document covers the Tizen AVPlay API capabilities and limitations relevant to implementing the Tizen media player store.

## API Overview

AVPlay is Samsung's proprietary media playback API for Tizen Smart TVs. It provides video/audio playback with support for various streaming protocols (HLS, DASH, Smooth Streaming).

**Official Documentation:**
- [AVPlay API Reference](https://developer.samsung.com/smarttv/develop/api-references/samsung-product-api-references/avplay-api.html)
- [Using AVPlay Guide](https://developer.samsung.com/smarttv/develop/guides/multimedia/media-playback/using-avplay.html)
- [Subtitle Guide](https://developer.samsung.com/smarttv/develop/guides/multimedia/subtitles.html)

---

## Player States

AVPlay operates in distinct states. Most methods can only be called in specific states.

```typescript
type AVPlayState = 'NONE' | 'IDLE' | 'READY' | 'PLAYING' | 'PAUSED'
```

**State Transitions:**
- `NONE` → `open(url)` → `IDLE`
- `IDLE` → `prepare()` → `READY`
- `READY` → `play()` → `PLAYING`
- `PLAYING` ↔ `pause()` ↔ `PAUSED`
- Any state → `stop()` → `IDLE`
- Any state → `close()` → `NONE`

---

## 1. Playback Control Methods

### Basic Playback

```typescript
// Open media URL
window.webapis.avplay.open(url: string): void
// State: NONE → IDLE

// Prepare for playback (loads metadata, creates decoder)
window.webapis.avplay.prepare(): void
// State: IDLE → READY

// Start/resume playback
window.webapis.avplay.play(): void
// State: READY/PAUSED → PLAYING

// Pause playback
window.webapis.avplay.pause(): void
// State: PLAYING → PAUSED

// Stop playback (releases decoder)
window.webapis.avplay.stop(): void
// State: Any → IDLE

// Close player instance
window.webapis.avplay.close(): void
// State: Any → NONE
```

### Seeking

```typescript
// Seek to absolute position
window.webapis.avplay.seekTo(
  milliseconds: number,
  successCallback?: () => void,
  errorCallback?: (error: any) => void
): void
// State: IDLE, READY, PLAYING, PAUSED

// Jump forward by relative duration
window.webapis.avplay.jumpForward(
  milliseconds: number,
  successCallback?: () => void,
  errorCallback?: (error: any) => void
): void
// State: READY, PLAYING, PAUSED

// Jump backward by relative duration
window.webapis.avplay.jumpBackward(
  milliseconds: number,
  successCallback?: () => void,
  errorCallback?: (error: any) => void
): void
// State: READY, PLAYING, PAUSED
```

### Playback Speed

```typescript
// Set playback speed/rate
window.webapis.avplay.setSpeed(speed: number): void
// Valid values: -16, -8, -4, -2, 1, 2, 4, 8, 16
// State: READY, PLAYING, PAUSED
```

**Note:** Negative values = reverse playback. Not all content supports all speeds.

---

## 2. Time & Duration

```typescript
// Get total media duration
window.webapis.avplay.getDuration(): number
// Returns: milliseconds

// Get current playback position
window.webapis.avplay.getCurrentTime(): number
// Returns: milliseconds

// Get current player state
window.webapis.avplay.getState(): AVPlayState
// Returns: 'NONE' | 'IDLE' | 'READY' | 'PLAYING' | 'PAUSED'
```

---

## 3. Audio Track Management

### Track Selection

```typescript
// Get all available tracks (audio, video, subtitle)
window.webapis.avplay.getTotalTrackInfo(): AVPlayTrackInfo[]

interface AVPlayTrackInfo {
  type: 'AUDIO' | 'VIDEO' | 'TEXT'
  index: number
  extra_info?: string  // Language, codec, channels (JSON string)
}

// Switch audio or subtitle track
window.webapis.avplay.setSelectTrack(
  trackType: 'AUDIO' | 'TEXT',
  trackIndex: number
): void
// State: READY, PLAYING, PAUSED
// Note: VIDEO type not supported for track switching
```

**Example Track Info:**
```javascript
[
  { type: 'AUDIO', index: 0, extra_info: '{"language":"eng","channels":2}' },
  { type: 'AUDIO', index: 1, extra_info: '{"language":"tur","channels":2}' },
  { type: 'TEXT', index: 0, extra_info: '{"language":"eng"}' },
  { type: 'VIDEO', index: 0, extra_info: '{"codec":"h264"}' }
]
```

### Audio Stream Control

```typescript
// Enable audio output (unmute)
window.webapis.avplay.enableAudioStream(): void

// Disable audio output (mute)
window.webapis.avplay.disableAudioStream(): void
```

**⚠️ Important:** Tizen does NOT provide application-level volume control. System volume is controlled via TV remote.

---

## 4. Subtitle Management

### Subtitle Display

```typescript
// Toggle subtitle visibility
window.webapis.avplay.setSilentSubtitle(hidden: boolean): void
// true = hide subtitles, false = show subtitles
// State: IDLE, READY, PLAYING, PAUSED

// Load external subtitle file
window.webapis.avplay.setExternalSubtitlePath(filePath: string): void
// State: IDLE only
// Supported formats: .smi (UTF-8), SMPTE-TT, DFXP (Smooth Streaming)
// Note: Must be local file path (not HTTP URL)

// Adjust subtitle timing (sync delay)
window.webapis.avplay.setSubtitlePosition(position: number): void
// position: milliseconds (positive = delay, negative = advance)
// State: PLAYING, PAUSED
```

### Subtitle Events

```typescript
// Subtitle change callback (set via setListener)
onsubtitlechange: (
  duration: string,
  subtitles: string,
  type: string,
  attributes: AVPlaySubtitleAttribute[]
) => void
```

---

## 5. Event Listeners

### Setting Listener

```typescript
window.webapis.avplay.setListener(listener: AVPlayPlaybackCallback): void
// State: Any (recommended: IDLE before prepare())
```

### Callback Interface

```typescript
interface AVPlayPlaybackCallback {
  // State changes
  onstreamcompleted?: () => void  // Playback finished

  // Time updates
  oncurrentplaytime?: (currentTime: number) => void  // Periodic time update (milliseconds)

  // Buffering events
  onbufferingstart?: () => void
  onbufferingprogress?: (percent: number) => void  // 0-100
  onbufferingcomplete?: () => void

  // Error handling
  onerror?: (eventType: AVPlayError) => void
  onerrormsg?: (eventType: AVPlayError, errorMsg: string) => void

  // Subtitle events
  onsubtitlechange?: (
    duration: string,
    subtitles: string,
    type: string,
    attributes: AVPlaySubtitleAttribute[]
  ) => void

  // Generic events
  onevent?: (eventType: AVPlayEvent, data: string) => void

  // DRM events (if needed)
  ondrmevent?: (drmType: AVPlayDrmType, drmData: any) => void
}
```

### Error Codes

Common AVPlay error codes:
- `PLAYER_ERROR_NONE` - No error
- `PLAYER_ERROR_INVALID_OPERATION` - Invalid state for operation
- `PLAYER_ERROR_INVALID_PARAMETER` - Invalid parameter
- `PLAYER_ERROR_CONNECTION_FAILED` - Network connection failed
- `PLAYER_ERROR_NOT_SUPPORTED_FILE` - Unsupported codec/format
- `PLAYER_ERROR_INVALID_URI` - Invalid URL

---

## 6. Buffering Configuration

```typescript
// Set buffering timeout
window.webapis.avplay.setTimeoutForBuffering(seconds: number): void
// Recommended: 3-10 seconds
// State: IDLE, READY, PLAYING, PAUSED

// Configure buffer size thresholds
window.webapis.avplay.setBufferingParam(
  option: 'PLAYER_BUFFER_FOR_PLAY' | 'PLAYER_BUFFER_FOR_RESUME',
  unit: 'PLAYER_BUFFER_SIZE_IN_SECOND',
  amount: number  // Minimum 4 seconds
): void
// State: IDLE only
```

---

## 7. Display Control

```typescript
// Set video display area (pixel coordinates)
window.webapis.avplay.setDisplayRect(
  x: number,
  y: number,
  width: number,
  height: number
): void
// State: IDLE, READY, PLAYING, PAUSED
```

**Note:** Tizen TVs are always fullscreen. This method allows positioning video within the screen, but not creating floating windows like VLC sticky mode.

---

## Features NOT Supported

The following VLC features have **no AVPlay equivalent**:

### ❌ Application Volume Control
- No `setVolume()` or `getVolume()` API
- TV system handles volume via remote control
- Apps can only mute/unmute audio stream

### ❌ Video Settings
- No aspect ratio control (`setAspectRatio`)
- No crop control (`setCrop`)
- No scale control (`setScale`)
- No deinterlace control (`setDeinterlace`)

### ❌ Audio Delay
- Subtitle delay available (`setSubtitlePosition`)
- No API for audio delay adjustment

### ❌ Window Management
- No window positioning/resizing (like VLC sticky mode)
- TV apps are always fullscreen
- Only `setDisplayRect` for video area within screen

### ❌ Video Track Selection
- Can select audio/subtitle tracks
- Cannot select different video tracks (multi-angle content)

---

## Implementation Strategy for Zenith TV

### Approach: Interface Parity with Stubs

Create `tizenPlayer.ts` store that:

**✅ Fully Implements:**
- Playback control (play, pause, stop, seek)
- Audio track selection
- Subtitle track selection
- Time/duration tracking
- State management
- Buffering events
- Watch progress auto-save
- Track preference persistence

**⚠️ Stub/No-op:**
- Volume/mute (returns current value, doesn't control)
- Screen modes (always report 'fullscreen')
- Window control methods (return false)
- Video settings (aspectRatio, crop, scale, deinterlace)
- Audio delay
- Keyboard shortcuts (TV uses D-pad)

**🔄 Adapted:**
- Track info format (map Tizen track structure to VLC format)
- Error handling (map AVPlay error codes to VLC error messages)
- Event system (map AVPlay callbacks to unified event format)

### Typical Usage Pattern

```typescript
// 1. Open and prepare
await webapis.avplay.open(url)
webapis.avplay.setListener({ /* callbacks */ })
await webapis.avplay.prepare()

// 2. Get track info
const tracks = webapis.avplay.getTotalTrackInfo()
// Map to VLC track format

// 3. Play
webapis.avplay.play()

// 4. Monitor playback
// Use oncurrentplaytime callback for time updates
// Use onbufferingstart/progress/complete for buffering state

// 5. Clean up
webapis.avplay.stop()
webapis.avplay.close()
```

---

## Next Steps

1. **Update type definitions** (`apps/tizen/src/types/tizen.d.ts`)
   - Add complete AVPlay interface
   - Add callback interfaces
   - Add track info types

2. **Create Tizen player store** (`apps/tizen/src/stores/tizenPlayer.ts`)
   - Same interface as VLC store
   - AVPlay implementation
   - Event mapping layer
   - Track format conversion

3. **Shared types consideration**
   - Consider extracting common player interface to `shared/player`
   - Platform-specific implementations (VLC, AVPlay)
   - Allows shared UI components

4. **Testing requirements**
   - Test on actual Tizen TV or emulator
   - Verify track selection works
   - Test buffering behavior
   - Validate error handling
