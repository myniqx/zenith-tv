# Zenith TV - Feature Checklist

Cross-platform IPTV player development progress tracker.

**Last Updated:** 2025-11-09

---

## 📊 Overall Progress

| Platform | Core | UI/UX | P2P Remote | Total |
|----------|------|-------|------------|-------|
| **Desktop** | 100% | 100% | 100% | **100%** |
| **Tizen TV** | 0% | 0% | 0% | **0%** |
| **Android** | 0% | 0% | 0% | **0%** |

---

## 💻 Desktop (Electron + React)

### ✅ Completed Features

#### Core Backend
- ✅ Rust M3U parser compiled to WASM
- ✅ TypeScript WASM wrapper (`@zenith-tv/parser`)
- ✅ SQLite database setup (better-sqlite3)
- ✅ Database schema (7 tables)
- ✅ Database service layer with full CRUD
- ✅ IPC handlers (main ↔ renderer)
- ✅ TypeScript API definitions

#### UI Components
- ✅ Electron + React + Vite setup
- ✅ Tailwind CSS configuration
- ✅ Video Player component
- ✅ Player Controls (play/pause, seek, volume, fullscreen)
- ✅ Keyboard shortcuts (Space, F, M, K, ←/→)
- ✅ Profile Manager modal
- ✅ Category Browser sidebar (6 categories)
- ✅ Content Grid with responsive layout
- ✅ Category badges (LIVE, S01E01, MOVIE)
- ✅ Split screen view (Grid + Player)

#### State Management
- ✅ Zustand stores (player, profiles, content)
- ✅ SQLite database integration with stores
- ✅ Profile sync with M3U fetch and parse

#### M3U Integration
- ✅ Fetch M3U from URL with progress tracking
- ✅ Parse with Rust WASM
- ✅ Save to SQLite with upsert
- ✅ Detect new items
- ✅ Update profile sync timestamp
- ✅ Sync UI with progress indicator

### 🚧 In Progress

None currently

### ❌ Pending Features

#### Core Features
- ✅ Replace mock data with DB data
- ✅ Load items from SQLite by profile
- ✅ Favorites toggle + DB persistence
- ✅ Recent tracking (30-day window)
- ✅ Watch history + resume playback
- ✅ Auto-save video position
- ✅ Series episode grouping
- ✅ Season/Episode sorting

#### Search & Filter
- ✅ Search input (title, group)
- ✅ Live search with real-time filtering
- ✅ Sort by (Name, Date, Recently Watched)
- ✅ Sort order toggle (Ascending/Descending)
- ✅ Keyboard shortcut (Ctrl+F)

#### Player Enhancements
- ✅ Auto-resume from last position
- ✅ Next/Previous episode
- ✅ Auto-play next episode
- ✅ Remember volume level
- ✅ Remember subtitle/audio tracks
- ✅ Retry failed streams
- ✅ Detailed error messages

#### P2P Remote Control
- ✅ WebSocket server
- ✅ Device discovery (via WebSocket connection)
- ✅ Device pairing (PIN-based)
- ✅ Pairing dialog UI
- ✅ Remote control interface
- ✅ Send commands (play, seek, volume, pause)
- ✅ Receive commands
- ✅ State synchronization (broadcast player state)
- ✅ "Controlled by [Device]" notification indicator

#### Settings & Preferences
- ✅ Settings panel
- ✅ Theme (Dark/Light) - Dark implemented
- ✅ Language selection - UI ready
- ✅ Auto-update M3U interval
- ✅ Default category
- ✅ Default volume
- ✅ Auto-resume toggle
- ✅ Network settings (port, device name) - Prepared for P2P

#### UI/UX Polish
- ✅ Toast notifications (success, error, info, warning)
- ✅ Skeleton loaders
- ✅ Progress bar for M3U download
- ✅ Loading states for DB operations
- ✅ Keyboard navigation (Tab, Arrow keys, Enter, Home, End)
- ✅ ARIA labels (comprehensive accessibility)
- ✅ High contrast mode

#### Performance
- ✅ Virtual scrolling (1000+ items)
- ✅ Lazy load thumbnails (native loading="lazy")
- ✅ Cache parsed M3U
- ✅ Debounce search (300ms)
- ✅ React.memo for ContentCard optimization
- ✅ Optimize DB queries (indexes)

---

## 📺 Tizen TV (Web App)

### ❌ All Features Pending

#### Core
- ❌ Tizen Web App project setup
- ❌ Rust WASM M3U parser integration
- ❌ sql.js database (WASM SQLite)
- ❌ Storage adapter for sql.js

#### Player
- ❌ AVPlay API integration
- ❌ Multi-audio track support
- ❌ Subtitle support (VTT/SRT)
- ❌ D-pad navigation

#### UI
- ❌ React components (shared from Desktop)
- ❌ TV-optimized layout
- ❌ Focus navigation
- ❌ Remote control mapping

#### P2P
- ❌ WebSocket server/client
- ❌ mDNS service
- ❌ Device pairing
- ❌ Remote control (both ways)

#### Build
- ❌ Tizen Studio configuration
- ❌ `.wgt` package generation
- ❌ Certificate signing

---

## 📱 Android (Flutter)

### ❌ All Features Pending

#### Core
- ❌ Flutter project setup
- ❌ Rust FFI bindings
- ❌ drift + rusqlite integration
- ❌ M3U parser via FFI

#### Player
- ❌ ExoPlayer integration
- ❌ Multi-track support
- ❌ PiP mode

#### UI
- ❌ Adaptive layouts (Phone/Tablet/TV)
- ❌ D-pad navigation (TV)
- ❌ Touch gestures (Phone/Tablet)
- ❌ Material 3 Design

#### P2P
- ❌ WebSocket client
- ❌ NSD (Network Service Discovery)
- ❌ Device pairing
- ❌ Remote control interface

#### Build
- ❌ APK build configuration
- ❌ Android TV support
- ❌ Google Play signing

---

## 🔗 Shared Components

### ✅ Completed
- ✅ `@zenith-tv/types` - TypeScript type definitions
- ✅ `@zenith-tv/protocol` - WebSocket protocol helpers
- ✅ `@zenith-tv/ui` - Zustand player store
- ✅ `@zenith-tv/parser` - Rust WASM M3U parser

### ❌ Pending
- ❌ `@zenith-tv/db-web` - sql.js wrapper (Tizen)
- ❌ WebSocket protocol implementation
- ❌ mDNS utilities
- ❌ Device pairing logic
- ❌ Shared React components library

---

## 🎯 Current Sprint (Phase 1)

### Goals ✅ COMPLETE
1. ✅ ~~Build Rust WASM parser~~
2. ✅ ~~SQLite setup + schema~~
3. ✅ ~~M3U fetch & parse integration~~
4. ✅ ~~Replace mock data with DB~~
5. ✅ ~~Favorites functionality~~
6. ✅ ~~Recent tracking~~
7. ✅ ~~Watch history + resume~~

### Phase 2 Goals ✅ COMPLETE
- ✅ ~~Search & filter~~
- ✅ ~~Settings panel~~
- ✅ ~~Toast notifications~~
- ✅ ~~Loading states~~
- ✅ ~~Sort functionality~~
- ✅ ~~Performance optimizations~~

### Phase 3 Goals ✅ COMPLETE
- ✅ ~~P2P Remote Control~~
- ✅ ~~Keyboard navigation~~
- ✅ ~~ARIA labels~~
- ✅ ~~High contrast mode~~

### Future (Phase 4)
- Tizen app
- Android app

---

## 📝 Notes

### Desktop
- Using better-sqlite3 for native SQLite
- WASM parser integrated with M3U sync
- Profile manager with sync button and progress indicator
- DB-backed content store with favorites and watch history
- Auto-resume playback from last position
- Auto-save watch progress every 10 seconds
- Real-time search with Ctrl+F keyboard shortcut
- Multi-criteria sort (Name, Date, Recently Watched)
- Toast notification system for all operations
- Comprehensive error handling with user-friendly messages
- Settings panel with localStorage persistence
- Debounced search input (300ms)
- React.memo optimization for content cards
- Lazy loading images for better performance
- Series episode grouping and sorting (S01E01, S01E02, etc.)
- Next/Previous episode navigation buttons
- Auto-play next episode (configurable in settings)
- Volume level persistence across sessions
- Auto-retry failed streams (exponential backoff, 3 attempts)
- Detailed error messages for different failure types
- Enhanced series display in player controls
- Virtual scrolling with react-window (handles 1000+ items)
- Responsive grid with dynamic column calculation
- ResizeObserver for automatic layout updates
- M3U caching system (24-hour expiration)
- ETag and Last-Modified header support
- Force sync option to bypass cache
- Automatic expired cache cleanup on startup
- Database indexes for optimal query performance
- Track preferences (audio/subtitle) saved to localStorage
- PIN-based P2P device pairing (4-digit)
- WebSocket server for remote control (port 8080)
- Pairing dialog UI for accepting/rejecting connections
- Remote control indicator showing connection status
- P2P commands: play, pause, seek, set volume
- State broadcast to connected devices (every 2 seconds)
- Full keyboard navigation (arrow keys, Tab, Enter, Home, End)
- Visual indicator for keyboard-selected items (blue ring)
- Auto-scroll to keep selected item in view
- Comprehensive ARIA labels for screen readers
- role attributes (banner, main, toolbar, search, button)
- aria-pressed, aria-label, aria-live attributes throughout
- High contrast mode with black/white/yellow theme
- High contrast toggle in Settings (Appearance section)
- Strong borders and focus indicators in high contrast mode

### Tizen
- Not started
- Will share React components with Desktop
- Need AVPlay API research
- sql.js for in-browser SQLite

### Android
- Not started
- Will use Rust FFI for parser
- ExoPlayer for video
- drift for SQLite

---

## 🔗 Related Documents

- [README.md](./README.md) - Project overview
- [core/parser/](./core/parser/) - Rust M3U parser
- [apps/desktop/](./apps/desktop/) - Desktop app
- [apps/tizen/](./apps/tizen/) - Tizen app (planned)
- [apps/mobile/](./apps/mobile/) - Android app (planned)

---

**Legend:**
- ✅ Completed
- 🔄 In Progress
- ❌ Not Started
- 🚧 Blocked/Issues
