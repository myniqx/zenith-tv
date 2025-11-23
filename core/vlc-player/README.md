# @zenith-tv/vlc-player

Native libVLC bindings for Electron/Node.js with full codec support.

## Features

- Full MKV container support
- Multi-track audio selection
- Multi-track subtitle support (ASS, SRT, PGS, etc.)
- Live streaming (HLS, RTMP, RTSP)
- Hardware decoding support
- Cross-platform (Windows, Linux, macOS)

## Prerequisites

### Windows

**Important:** VLC does not provide ARM64 builds. If you're on ARM64 Windows, you need to build with `--arch=x64`.

#### Option 1: Automatic Setup (Recommended)

```bash
cd core/vlc-player

# Download VLC SDK (requires 7-Zip installed and in PATH)
node scripts/download-vlc-sdk.js

# Build native addon (x64)
npx node-gyp rebuild --arch=x64
```

If 7-Zip is not installed, the script will show instructions to extract manually.

#### Option 2: Manual Setup

1. Download VLC **7z package** (NOT the ZIP or installer!) from:
   https://download.videolan.org/pub/videolan/vlc/3.0.20/win64/vlc-3.0.20-win64.7z

   > The 7z package contains the SDK folder with headers and .lib files. The ZIP package does NOT include SDK.

2. Extract and copy files to `lib/win32/`:

```
lib/win32/
├── sdk/
│   ├── include/
│   │   └── vlc/
│   │       └── *.h (libvlc.h, vlc.h, etc.)
│   └── lib/
│       └── libvlc.lib
├── libvlc.dll
├── libvlccore.dll
└── plugins/
    └── *.dll (367 plugin files)
```

3. Build native addon:

```bash
cd core/vlc-player
npx node-gyp rebuild --arch=x64
```

### Linux

```bash
# Ubuntu/Debian
sudo apt install libvlc-dev vlc

# Fedora
sudo dnf install vlc-devel vlc

# Arch
sudo pacman -S vlc
```

### macOS

```bash
brew install vlc

# Or download from https://www.videolan.org/vlc/
# The framework will be at /Applications/VLC.app/Contents/MacOS/
```

## Building

```bash
# Install dependencies
pnpm install

# Build native addon
# On Windows (x64 required due to VLC SDK):
npx node-gyp rebuild --arch=x64

# On Linux/macOS:
npx node-gyp rebuild
```

### Troubleshooting

**"Cannot find module" error on ARM64 Windows:**
- VLC only provides x64 binaries. Make sure you built with `--arch=x64`
- Run Electron/Node.js in x64 mode

**"ssize_t not defined" compilation error:**
- This is fixed in the latest code. Make sure `vlc_player.cpp` includes the Windows-specific typedef.

**"SDK folder not found" error:**
- You downloaded the ZIP file instead of 7z. Only the 7z package contains the SDK.

**Linker errors (unresolved external symbols):**
- Make sure `lib/win32/sdk/lib/libvlc.lib` exists
- Verify you're using the official VLC SDK, not just the DLLs

## Usage

```javascript
const { createPlayer } = require('@zenith-tv/vlc-player');

const player = createPlayer();

// Set window handle for video rendering
player.setWindow(windowHandle);

// Play media
player.play('http://example.com/stream.m3u8');

// Event handling
player.on('stateChanged', (state) => {
  console.log('Player state:', state);
});

player.on('timeChanged', (time) => {
  console.log('Time:', time, 'ms');
});

// Audio tracks
const audioTracks = player.getAudioTracks();
player.setAudioTrack(audioTracks[1].id);

// Subtitle tracks
const subtitleTracks = player.getSubtitleTracks();
player.setSubtitleTrack(subtitleTracks[0].id);

// Cleanup
player.dispose();
```

## API

See `index.d.ts` for full TypeScript definitions.

## License

LGPL-2.1 (due to libVLC dependency)
