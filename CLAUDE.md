# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zenith TV is a modern cross-platform IPTV player with peer-to-peer remote control support. The project uses a monorepo structure with pnpm workspaces.

**Current Status:**

- Desktop app (Electron): 100% complete
- Tizen TV app: Planned (0%)
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

# Run from desktop app directory
cd apps/desktop
pnpm dev
```

### Building

```bash
# Build desktop app for production
cd apps/desktop
pnpm build

# Package desktop app for distribution
pnpm build:electron
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

The project uses pnpm workspaces with the following packages:

**Core Packages:**

- `core/parser/` - Rust M3U parser compiled to WASM for web (and FFI for native platforms)
- `core/vlc-player/` - Native VLC player addon for Electron (C++ N-API)
- Parser is critical: must rebuild with `wasm-pack build --target web --release` after changes

**Shared Packages:**

- `shared/types/` - TypeScript type definitions shared across all platforms
- `shared/protocol/` - WebSocket protocol for P2P communication
- `shared/ui/` - Shared React components and Zustand stores

**Apps:**

- `apps/desktop/` - Electron app (main platform, fully functional)
- `apps/tizen/` - Tizen TV web app (planned)
- `apps/mobile/` - Flutter Android app (planned)

### Desktop App Architecture

**Two-Process Model (Electron):**

1. **Main Process** (`apps/desktop/electron/`):
   - `main.cjs` - Window management, IPC setup, app lifecycle
   - `storage/` - JSON-based storage system (profiles, M3U cache, user data)
   - `p2p-server.cjs` - WebSocket server for remote control
   - `preload.cjs` - Secure IPC bridge to renderer

2. **Renderer Process** (`apps/desktop/src/`):
   - React 19 app with TypeScript
   - Vite for bundling and hot reload
   - Communicates with main process via IPC

**State Management:**

- Uses Zustand for all client state
- Four main stores in `src/stores/`:
  - `content.ts` - Content items, filtering, sorting, series navigation
  - `profiles.ts` - User profiles and M3U playlist management
  - `settings.ts` - App settings (persisted to localStorage)
  - `toast.ts` - Toast notifications

**Storage Layer:**

- JSON-based file storage (lightweight, no native dependencies)
- Three main storage managers in `electron/storage/`:
  - `profile-manager.cjs` - User profiles with M3U references
  - `m3u-manager.cjs` - M3U content caching and metadata
  - `user-data-manager.cjs` - Per-user, per-M3U preferences (favorites, watch progress, hidden items)
- All storage operations go through IPC handlers in `main.cjs`
- Storage path: `app.getPath('userData')/zenith-storage/`

**M3U Processing Pipeline:**

1. Fetch M3U from URL with progress tracking
2. Check cache (JSON files with 24-hour TTL)
3. Parse using Rust WASM parser (`@zenith-tv/parser`)
4. Build CategoryTree in Rust (group-based hierarchical structure)
5. Cache M3U content and metadata as JSON
6. Auto-detect categories (movie, series, live_stream)
7. Extract episode info (S01E01, 1x01 patterns)

**Category Tree System (NEW):**

- Category tree built entirely in Rust (`core/parser/src/category_tree.rs`)
- Hierarchical structure: Type (Movies/Series/Live) → Group → Items
- WASM bindings expose methods: `tree.getMovies()`, `tree.getSeries()`, `tree.getLiveStreams()`
- Sticky/Hidden group filtering happens in Rust (zero serialization overhead)
- Cross-platform: Same Rust code works via WASM (Desktop/Tizen) and FFI (Android)
- User preferences (sticky/hidden groups) stored in profile JSON

**P2P Remote Control:**

- WebSocket server on port 8080
- PIN-based device pairing (4-digit)
- Commands: play, pause, seek, set_volume
- State broadcast every 2 seconds to paired devices
- Protocol defined in `shared/protocol/`

### Key Components

**Video Player** (`src/components/VideoPlayer.tsx`):

- Dual backend: VLC (native) or HTML5 (browser), configurable in settings
- VLC backend: Better codec support (MKV, HEVC, live streams)
- HTML5 backend: Fallback for when VLC is not available
- Auto-selects VLC when available (auto mode)
- Auto-resume from last position
- Multi-track audio/subtitle support with persistence
- Auto-retry on stream failure (3 attempts, exponential backoff)
- Keyboard shortcuts (Space, F, M, K, arrows)
- Next/Previous episode navigation for series
- Auto-play next episode (configurable)

**Content Grid** (`src/components/ContentGrid.tsx`):

- Virtual scrolling with react-window (handles 1000+ items)
- Keyboard navigation (arrow keys, Tab, Enter, Home, End)
- Visual indicator for keyboard-selected items
- Lazy image loading
- Category badges (LIVE, S01E01, MOVIE)

**Category Browser** (`src/components/CategoryBrowser.tsx`):

- 6 categories: All, Movies, Series, Live TV, Favorites, Recent
- Real-time search with debouncing (300ms)
- Sort by: Name, Date, Recently Watched
- Keyboard shortcut: Ctrl+F for search

**Profile Manager** (`src/components/ProfileManager.tsx`):

- Add/delete profiles
- M3U URL management
- Sync with progress indicator
- Cache status and force sync option

**Settings Panel** (`src/components/Settings.tsx`):

- Four sections: Appearance, Content, Player, Network
- Persisted to localStorage
- High contrast mode toggle
- Auto-resume, auto-play settings

## Troubleshooting

### VLC Player Not Working

- Ensure VLC SDK is downloaded: `cd core/vlc-player && node scripts/download-vlc-sdk.js`
- Rebuild native addon: `node-gyp rebuild`
- Check `core/vlc-player/lib/{platform}/` directory exists
- Windows: Verify libvlc.dll and plugins/ folder present
- Linux: Install system VLC: `apt install vlc libvlc-dev`
- Check Settings → Player Backend is set to "VLC" or "Auto"

### Parser Not Found

- Ensure WASM is built: `cd core/parser && wasm-pack build --target web --release`
- Check `core/parser/pkg/` directory exists
- Verify import in `core/parser/index.ts`

### Storage Issues

- Check storage path: `app.getPath('userData')/zenith-storage/`
- Verify write permissions
- Look for JSON parsing errors in console
- Check file system adapter initialization

### IPC Not Working

- Check preload script is loaded (main.cjs line 23)
- Verify contextBridge is exposing API correctly
- Check ipcMain.handle is registered before window creation
- Look for errors in both main and renderer console
- Verify API names: `window.electron.profile.*`, not `window.electronAPI.db.*`

### Hot Reload Not Working

- Restart Vite dev server
- Check Vite config in `apps/desktop/vite.config.ts`
- Electron needs manual restart for main process changes

## Code Style

- **TypeScript**: Strict mode enabled
- **Imports**: Use aliases from workspace packages (`@zenith-tv/*`)
- **Async/Await**: Preferred over promises
- **Error Handling**: Try-catch with user-friendly messages
- **Comments**: JSDoc for exported functions
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **File Organization**: Group by feature, not by type

## Platform-Specific Notes

### Desktop (Electron)

- Node.js >= 18.0.0 required
- Native VLC player addon for video playback (C++ N-API)
- Main process code is CommonJS (require/module.exports)
- Renderer process code is ESM (import/export)
- Rust parser via WASM (web target)

**VLC Player Setup (required for native playback):**

```bash
# Navigate to VLC player package
cd core/vlc-player

# Download VLC SDK (auto-detects platform)
node scripts/download-vlc-sdk.js

# Build native addon
npm run build
# OR
node-gyp rebuild
```

**VLC SDK Structure:**

- Windows: `core/vlc-player/lib/win32/` - libvlc.dll, libvlccore.dll, plugins/
- Linux: Uses system libvlc (apt install vlc libvlc-dev)
- macOS: `core/vlc-player/lib/darwin/` - VLC.app framework

**electron-builder bundles VLC automatically:**

- extraResources config copies `lib/{platform}/` to `resources/vlc/`
- Runtime path: `process.resourcesPath + '/vlc'`

### Tizen (Planned)

- JSON-based storage (same as Desktop)
- Rust parser via WASM (web target)
- AVPlay API for video playback
- D-pad navigation required
- Must package as .wgt file

### Android (Planned)

- Flutter with Rust FFI for parser (native target, not WASM)
- JSON-based storage via Flutter file I/O
- ExoPlayer for video
- CategoryTree via Rust FFI (same code, different bindings)
- Adaptive layouts (phone/tablet/TV)

## Performance Considerations

- Virtual scrolling is essential for 1000+ items
- Debounce search input (currently 300ms)
- Use React.memo for ContentCard components
- Lazy load images with native loading="lazy"
- Cache M3U content (24-hour expiration)
- **CategoryTree filtering in Rust** - Zero serialization overhead
- **WASM direct method calls** - No JSON parsing for category operations
- JSON file caching reduces re-parsing
- Auto-cleanup expired cache on startup
