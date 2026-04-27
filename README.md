# Zenith TV

> [!WARNING]
> **This repository is no longer actively maintained.**
> Development has moved to a private Flutter-based rewrite. The code here is kept public as a reference — feel free to explore or fork it.

A modern cross-platform IPTV player with peer-to-peer remote control support.

## Platforms

| Platform | Status | Tech |
|----------|--------|------|
| Desktop | Complete | Electron + React + VLC |
| Tizen TV | ~85% complete | React + AVPlay |
| Android | Planned | Flutter |

## Monorepo Structure

```
zenith-tv/
├── apps/
│   ├── desktop/       # Electron app (main platform)
│   └── tizen/         # Samsung Smart TV web app
├── core/
│   ├── parser/        # Rust M3U parser compiled to WASM
│   └── vlc-player/    # Native VLC addon for Electron (C++ N-API)
└── shared/
    ├── content/       # Types, models, stores, utils (all platforms)
    └── ui/            # Shared React/shadcn components
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Build Rust WASM parser (required)
pnpm build:parser

# Desktop — download and build native VLC addon (required)
pnpm download:vlc-sdk
pnpm build:vlc

# Run desktop app
pnpm dev:desktop

# Run Tizen app in browser
pnpm dev:tizen
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev:desktop` | Run desktop app in development mode |
| `pnpm dev:tizen` | Run Tizen app in browser (development) |
| `pnpm build:parser` | Build Rust M3U parser to WASM |
| `pnpm build:vlc` | Build native VLC addon |
| `pnpm rebuild:vlc` | Rebuild native VLC addon |
| `pnpm download:vlc-sdk` | Download VLC SDK for current platform |
| `pnpm download:vlc-sdk:all` | Download VLC SDK for all platforms |
| `pnpm build:desktop` | Build desktop app |
| `pnpm build:electron` | Package desktop app for distribution |
| `pnpm build:tizen` | Build Tizen app |
| `pnpm package:tizen` | Build and package Tizen app as .wgt |
| `pnpm build:all` | Build parser + VLC + desktop |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format all code with Prettier |
| `pnpm tsc` | TypeScript check all packages |

## Key Features

- M3U playlist support — parsed in Rust via WASM, handles 10k+ items
- P2P remote control — desktop acts as server, Tizen/other clients connect via WebSocket
- Profile system — multiple profiles, each with multiple M3U sources
- Watch progress sync — favorites, progress, track preferences synced across devices via timestamp-based merge
- D-pad navigation — full TV remote support on Tizen

## P2P Architecture

Desktop runs a combined HTTP + WebSocket server on port 8080. Tizen discovers it via subnet scan and connects as a client. Commands flow server to player; player state is broadcast back every 2 seconds.

```
Desktop (server)  --commands-->  Tizen (player / AVPlay)
                 <--state------
```

Profile and user data (favorites, watch progress) are synchronized bidirectionally with timestamp-based merging via `mergeUserData` in `shared/content`.

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Rust >= 1.75.0 + wasm-pack (for parser builds)
- CMake >= 3.12 (for native VLC addon)

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — full architecture reference
- [`apps/tizen/README.md`](./apps/tizen/README.md) — Tizen app details
