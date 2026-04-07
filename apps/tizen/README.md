# Zenith TV — Tizen

Samsung Smart TV web app built with React + Vite, packaged as `.wgt`.

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode (browser)
pnpm dev

# Build for Tizen (.wgt)
pnpm build
node scripts/create-wgt.js
```

## Features

- D-pad navigation system (FocusScope / FocusButton / FocusInput / FocusCard)
- AVPlay API for video playback (`src/stores/tizenPlayer.ts`)
- M3U parsing via shared Rust WASM parser (`@zenith-tv/parser`)
- JSON-based file storage (`src/lib/filesystem.ts`)
- P2P WebSocket client — connects to desktop server on port 8080
  - Auto-discovery via HTTP subnet scan (`httpDiscovery`)
  - Receives player commands: `open`, `playback`, `audio`, `subtitle`, `window`, `shortcut`
  - Broadcasts player state every 2 seconds
  - Profile sync with timestamp-based userData merge (`mergeUserData`)

## Architecture

### Stores

| Store | File | Description |
|-------|------|-------------|
| `useContentStore` | `stores/content.ts` | M3U content, group navigation |
| `useProfilesStore` | `stores/profiles.ts` | Profile and M3U source management |
| `useSettingsStore` | `stores/settings.ts` | Playback preferences (persisted) |
| `useTizenPlayerStore` | `stores/tizenPlayer.ts` | AVPlay API wrapper |
| `useP2PClientStore` | `stores/p2pClientStore.ts` | WebSocket client, server discovery |

### Screens (Header sections)

| Section | Component | Status |
|---------|-----------|--------|
| All | `ContentBrowser` | done |
| Favorites | `ContentBrowser` | done |
| P2P | `P2PView` | done |
| Settings | `Settings` | done |
| Profile | `ProfileManager` | done |
| Exit | — | done |

### Navigation System

TV-ready components in `src/components/Navigation/` extending shadcn:

- `FocusButton` — clickable actions
- `FocusInput` — text input (triggers on-screen keyboard)
- `FocusCard` — list and grid items
- `FocusScope` — navigation isolation via scope stack (modal, dialog, track panel)

### Video Player

`src/components/ContentBrowser/VideoPlayer.tsx`

- AVPlay init + auto-play on mount
- Play/Pause, ±30s seek, previous/next episode
- Audio and subtitle track selector (isolated via FocusScope)
- Controls auto-hide after 4 seconds, any key press reveals them
- Respects `autoResume` and `autoPlayNext` settings
- `<object type="application/avplayer">` for native Tizen video rendering

## Tizen API Notes

- **Volume**: System-level only — no app-level volume API (use TV remote)
- **Screen mode**: Always fullscreen, no windowed mode
- **Video track selection**: AVPlay only supports AUDIO and TEXT track switching, not VIDEO
- **Audio delay**: Not supported by AVPlay — only subtitle delay via `setSubtitlePosition`
- **Exit**: `tizen.application.getCurrentApplication().exit()`
- **AVPlay availability**: Only works on real Tizen device or emulator. Browser dev mode runs in stub mode (`isAvailable: false`)
