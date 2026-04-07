# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zenith TV is a modern cross-platform IPTV player with peer-to-peer remote control support. The project uses a monorepo structure with pnpm workspaces.

**Current Status:**

- Desktop app (Electron): 100% complete
- Tizen TV app: ~85% complete (AVPlay integration pending real device test)
- Android app: Planned (0%)

## Essential Commands

### Development

```bash
# Install all dependencies
pnpm install

# Build Rust M3U parser to WASM (required before running apps)
cd core/parser
wasm-pack build --target web --release
cd ../..

# Download VLC SDK and build native addon (required for video playback)
cd core/vlc-player
node scripts/download-vlc-sdk.js
node-gyp rebuild
cd ../..

# Run desktop app in development mode
pnpm dev:desktop

# Run Tizen app in development mode (browser)
cd apps/tizen
pnpm dev
```

### Building

```bash
# Build desktop app for production
cd apps/desktop
pnpm build

# Package desktop app for distribution
pnpm build:electron

# Build Tizen app (.wgt package)
cd apps/tizen
pnpm build
node scripts/create-wgt.js
```

### Code Quality

```bash
# Format all code
pnpm format

# Lint all code
pnpm lint

# TypeScript type checking (desktop app)
cd apps/desktop
pnpm type-check
```

## Architecture

### Monorepo Structure

**Core Packages:**

- `core/parser/` - Rust M3U parser compiled to WASM (web target for Desktop/Tizen)
- `core/vlc-player/` - Native VLC player addon for Electron (C++ N-API)

**Shared Packages:**

- `shared/content/` - TypeScript types, models, stores (content, toast, fileSync), utils (httpDiscovery, mergeUserData)
- `shared/ui/` - Shared React/shadcn components

**Apps:**

- `apps/desktop/` - Electron app (main platform, fully functional)
- `apps/tizen/` - Tizen TV web app (~85% complete)
- `apps/mobile/` - Flutter Android app (planned)

### Shared Content Package (`shared/content`)

Common code used by all platforms:

- `src/models/` - `GroupObject`, `WatchableObject`, `TvShowGroupObject`, etc.
- `src/types/` - `UserData`, `M3UUpdateData`, `P2PMessage`, `ProfileSyncPayload`, etc.
- `src/stores/content/` - `createContentStore()` factory (platform-agnostic)
- `src/stores/toast/` - Toast notification store
- `src/stores/tools/fileSync/` - JSON file sync middleware for Zustand
- `src/utils/httpDiscovery.ts` - HTTP subnet scan for P2P server discovery
- `src/utils/mergeUserData.ts` - Timestamp-based UserData merge (used by both platforms)

### Desktop App Architecture

**Two-Process Model (Electron):**

1. **Main Process** (`apps/desktop/electron/`):
   - `main.cjs` - Window management, IPC setup, app lifecycle
   - `ipc/p2pServer.ts` - Combined HTTP + WebSocket server (port 8080)
   - `ipc/p2pHandlers.ts` - IPC bridge for P2P events
   - `preload.cjs` - Secure IPC bridge to renderer

2. **Renderer Process** (`apps/desktop/src/`):
   - React 19 app with TypeScript
   - Vite for bundling and hot reload

**State Management (Desktop):**

- `stores/content.ts` - Content store created via `createContentStore()` factory
- `stores/profiles.ts` - Profile and M3U management
- `stores/settings.ts` - App settings (persisted)
- `stores/vlcPlayer.ts` - VLC native player wrapper
- `stores/p2pStore.ts` - P2P server/client management (mode: off/server/client)
- `stores/p2pPlayerStore.ts` - Remote player control over P2P
- `stores/universalPlayerStore.ts` - Automatically delegates to VLC or P2P player store

**P2P — Desktop:**

- `mode: 'server'` → receives commands from Tizen/client devices, forwards to VLC
- `mode: 'client'` → connects to another desktop, broadcasts VLC state
- First connecting device is automatically set as `selectedDeviceId`
- Welcome payload: sends `profile_sync` with profile info on new connection

### Tizen App Architecture

`apps/tizen/src/`

**Stores:**

- `stores/content.ts` - Created via `createContentStore()` with Tizen-specific filesystem/http dependencies
- `stores/profiles.ts` - Profile and M3U UUID mapping (localStorage persist)
- `stores/settings.ts` - `autoResume`, `autoPlayNext`, language preferences
- `stores/tizenPlayer.ts` - Full AVPlay API wrapper (play, pause, seek, track selection, progress saving)
- `stores/p2pClientStore.ts` - WebSocket client, server discovery, trusted server list

**Navigation System:**

`src/components/Navigation/` — TV-ready components extending shadcn:
- `FocusButton`, `FocusInput`, `FocusCard` - D-pad navigation support
- `FocusScope` - Navigation isolation via scope stack (modal/dialog/panel)
- `NavigationContext` - Global keyboard listener
- `useFocusable` hook - For building custom focusable components

**P2P — Tizen (client only):**

- Discovers desktop server via HTTP subnet scan
- WebSocket connection: `ws://server-ip:8080`
- Incoming commands: `open`, `playback`, `audio`, `video`, `subtitle`, `window`, `shortcut`
- Player state broadcast every 2 seconds via `state_update`
- `profile_sync` flow: create profile → if M3U missing send `request: 'full'` → timestamp-based userData merge → send merged result back

**Video Player:**

`src/components/ContentBrowser/VideoPlayer.tsx`
- AVPlay init + auto-play on mount
- Controls auto-hide after 4 seconds
- Audio/subtitle track selector panel (isolated via FocusScope)
- `<object type="application/avplayer">` for native Tizen video rendering

### P2P Protocol (Shared)

`shared/content/src/types/p2p.ts`

| Message type | Direction | Description |
|---|---|---|
| `open` | server→player | Open URL and play |
| `playback` | server→player | play/pause/stop/seek |
| `audio` | server→player | audio track, mute |
| `video` | server→player | video settings |
| `subtitle` | server→player | subtitle track, delay |
| `window` | server→player | screen mode |
| `shortcut` | server→player | keyboard shortcut action |
| `state_update` | player→server | player state broadcast (every 2s) |
| `profile_sync` | bidirectional | profile/M3U/userData synchronization |

## Troubleshooting

### VLC Player Not Working

- Ensure VLC SDK is downloaded: `cd core/vlc-player && node scripts/download-vlc-sdk.js`
- Rebuild native addon: `node-gyp rebuild`
- Check `core/vlc-player/lib/{platform}/` directory exists
- Windows: Verify libvlc.dll and plugins/ folder present
- Linux: Install system VLC: `apt install vlc libvlc-dev`

### Parser Not Found

- Ensure WASM is built: `cd core/parser && wasm-pack build --target web --release`
- Check `core/parser/pkg/` directory exists

### Tizen AVPlay Not Working

- AVPlay API only works on a real Tizen device or Tizen emulator
- In browser, `isAvailable` will be `false` and the store runs in stub mode
- Availability is checked via `window.webapis?.avplay`

### Storage Issues (Desktop)

- Storage path: `app.getPath('userData')/zenith-storage/`
- Check file system adapter initialization

### IPC Not Working (Desktop)

- Check preload script is loaded
- Verify contextBridge is exposing API correctly
- Verify API names: `window.electron.profile.*`

## Code Style

- **TypeScript**: Strict mode enabled
- **Imports**: Use aliases from workspace packages (`@zenith-tv/*`)
- **Async/Await**: Preferred over promises
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **File Organization**: Group by feature, not by type
- **Shared code**: `mergeUserData`, `httpDiscovery`, content store factory live in the shared package and are imported by both platforms

## Platform-Specific Notes

### Desktop (Electron)

- Node.js >= 18.0.0 required
- Main process: CommonJS (`require/module.exports`)
- Renderer process: ESM (`import/export`)
- Rust parser via WASM (web target)

**VLC SDK Structure:**

- Windows: `core/vlc-player/lib/win32/` - libvlc.dll, libvlccore.dll, plugins/
- Linux: Uses system libvlc (`apt install vlc libvlc-dev`)
- macOS: `core/vlc-player/lib/darwin/` - VLC.app framework

### Tizen

- React + Vite web app, packaged as `.wgt`
- Rust parser via WASM (web target) — same as desktop
- AVPlay API for video playback
- D-pad navigation required
- Volume control is system-level only (no app-level API)
- Always fullscreen (no windowed mode)

### Android (Planned)

- Flutter with Rust FFI for parser (native target, not WASM)
- ExoPlayer for video
- Adaptive layouts (phone/tablet/TV)
