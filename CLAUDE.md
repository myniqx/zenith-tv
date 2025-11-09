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
   - `main.js` - Window management, IPC setup, app lifecycle
   - `database.js` - SQLite database layer using better-sqlite3
   - `p2p-server.js` - WebSocket server for remote control
   - `preload.js` - Secure IPC bridge to renderer

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

**Database Layer:**
- SQLite via better-sqlite3 (native, synchronous)
- Schema in `electron/schema.sql` (7 tables)
- All DB operations go through `electron/database.js`
- IPC handlers expose DB methods to renderer
- Tables: profiles, items, series, favorites, watch_history, recent_items, m3u_cache

**M3U Processing Pipeline:**
1. Fetch M3U from URL with progress tracking
2. Check cache (`m3u_cache` table, 24-hour TTL)
3. Parse using Rust WASM parser (`@zenith-tv/parser`)
4. Convert to WatchableItem format
5. Upsert to database (preserves existing items)
6. Auto-detect categories (movie, series, live_stream)
7. Extract episode info (S01E01, 1x01 patterns)

**P2P Remote Control:**
- WebSocket server on port 8080
- PIN-based device pairing (4-digit)
- Commands: play, pause, seek, set_volume
- State broadcast every 2 seconds to paired devices
- Protocol defined in `shared/protocol/`

### Key Components

**Video Player** (`src/components/VideoPlayer.tsx`):
- HTML5 video element (no external player library)
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

## Important Patterns

### IPC Communication
All database operations use IPC:
```typescript
// Renderer process
const items = await window.electronAPI.db.getItemsByProfile(profileId);

// Defined in electron/preload.js
contextBridge.exposeInMainWorld('electronAPI', {
  db: {
    getItemsByProfile: (profileId) => ipcRenderer.invoke('db:getItemsByProfile', profileId),
    // ... other methods
  }
});

// Handler in electron/main.js
ipcMain.handle('db:getItemsByProfile', (_, profileId) => db.getItemsByProfile(profileId));
```

### Database Service Pattern
The database wrapper (`electron/database.js`) is a singleton that:
- Initializes on app startup
- Uses prepared statements for performance
- Implements transactions for multi-row operations
- Returns plain objects (not ORM instances)
- Handles all SQL directly (no query builder)

### Series Episode Handling
Series detection happens in the Rust parser using regex patterns:
- Detects: S01E01, 1x01, Episode 1, Ep 1, etc.
- Stores in separate `series` table with foreign key to `items`
- Content store provides helper methods for series navigation
- Episode sorting: season ASC, episode ASC

### State Persistence
- **Settings**: localStorage (JSON)
- **Watch history**: SQLite (auto-save every 10s)
- **Favorites**: SQLite (toggle via UI)
- **Track preferences**: localStorage (audio/subtitle)
- **Profile selection**: localStorage

### Error Handling
- Toast notifications for user-facing errors
- Console.error for developer debugging
- Retry logic for network failures
- Detailed error messages for different stream failure types

## Common Development Tasks

### Adding a New Database Table
1. Update `electron/schema.sql` with CREATE TABLE
2. Add indexes if needed
3. Add methods to `electron/database.js` (singleton class)
4. Expose via IPC in `electron/main.js` (ipcMain.handle)
5. Add to preload API in `electron/preload.js` (contextBridge)
6. Update TypeScript types in `src/types/electron.d.ts`
7. Call from renderer using `window.electronAPI.db.*`

### Adding a New P2P Command
1. Define message type in `shared/types/src/index.ts` (WSMessage union)
2. Add handler in `electron/p2p-server.js`
3. Add event emitter callback in `electron/main.js` (onXxxCommand)
4. Send IPC message to renderer (mainWindow.webContents.send)
5. Listen in renderer component (useEffect with IPC listener)
6. Update protocol serialization in `shared/protocol/src/index.ts`

### Modifying M3U Parser (Rust)
1. Edit Rust code in `core/parser/src/lib.rs`
2. Test with `cargo test` in parser directory
3. Rebuild WASM: `wasm-pack build --target web --release`
4. Output goes to `core/parser/pkg/`
5. TypeScript wrapper is in `core/parser/index.ts`
6. Restart dev server to pick up changes

### Adding UI Components
- Follow existing component structure in `src/components/`
- Use Tailwind CSS for styling (config in `tailwind.config.js`)
- Use `cn()` utility from `shared/ui/src/lib/cn.ts` for class merging
- Add ARIA labels for accessibility
- Support high contrast mode (check `useSettingsStore().highContrast`)

## Testing the Desktop App

### Manual Testing Checklist
1. Add a profile with valid M3U URL
2. Click Sync and verify items load
3. Test category filtering (Movies, Series, Live, Favorites, Recent)
4. Test search with various queries
5. Play a stream and verify controls work
6. Test keyboard shortcuts (Space, F, M, arrows)
7. Add to favorites and verify persistence
8. Close and reopen app - check auto-resume
9. Test series navigation (next/previous episode)
10. Test P2P pairing with another device

### P2P Testing
```bash
# Use websocat or similar WebSocket client
websocat ws://localhost:8080

# Send discover message
{"type":"discover","deviceName":"Test Device"}

# Request pairing
{"type":"pair_request","deviceId":"test-123","deviceName":"Test Device","pin":"1234"}

# Send play command (after pairing accepted)
{"type":"play","item":{...}}
```

## Troubleshooting

### Parser Not Found
- Ensure WASM is built: `cd core/parser && wasm-pack build --target web --release`
- Check `core/parser/pkg/` directory exists
- Verify import in `core/parser/index.ts`

### Database Locked
- Close all instances of the app
- Database is in WAL mode, so concurrent reads should work
- Check if another process is holding the DB file

### IPC Not Working
- Check preload script is loaded (main.js line 20)
- Verify contextBridge is exposing API correctly
- Check ipcMain.handle is registered before window creation
- Look for errors in both main and renderer console

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
- Uses better-sqlite3 (native module, requires rebuild for Electron)
- Main process code is CommonJS (require/module.exports)
- Renderer process code is ESM (import/export)

### Tizen (Planned)
- Will use sql.js (WASM SQLite) instead of better-sqlite3
- AVPlay API for video playback
- D-pad navigation required
- Must package as .wgt file

### Android (Planned)
- Flutter with Rust FFI for parser
- ExoPlayer for video
- drift + rusqlite for database
- Adaptive layouts (phone/tablet/TV)

## Performance Considerations

- Virtual scrolling is essential for 1000+ items
- Debounce search input (currently 300ms)
- Use React.memo for ContentCard components
- Lazy load images with native loading="lazy"
- Cache M3U content (24-hour expiration)
- Database indexes on frequently queried columns
- Auto-cleanup expired cache on startup
