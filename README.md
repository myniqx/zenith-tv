# Zenith TV

Modern cross-platform IPTV player with peer-to-peer remote control support.

[![Desktop: 100%](https://img.shields.io/badge/Desktop-100%25-success)](apps/desktop/)
[![Tizen: 0%](https://img.shields.io/badge/Tizen-0%25-inactive)](apps/tizen/)
[![Android: 0%](https://img.shields.io/badge/Android-0%25-inactive)](apps/mobile/)

## ✨ Features

### Desktop App (100% Complete)

- 🎬 **Universal IPTV Player**: Watch any M3U playlist with live streams, movies, and TV series
- 🔄 **P2P Remote Control**: Control playback from other devices on your local network
- 📺 **Smart Categorization**: Automatic content organization (Movies, Series, Live TV)
- 🎯 **Episode Detection**: Intelligent parsing of series episodes (S01E01, 1x01, etc.)
- 🎨 **Modern UI**: Clean, responsive interface with dark theme
- ⚡ **High Performance**: Rust-powered M3U parser with WASM compilation
- 🔊 **Multi-Track Support**: Multiple audio tracks and subtitle support with persistence
- 💾 **Offline First**: Local SQLite database with caching and sync capabilities
- 🌐 **P2P Control**: WebSocket-based remote control with PIN pairing
- ⌨️ **Keyboard Navigation**: Full keyboard support with visual indicators
- ♿ **Accessibility**: Comprehensive ARIA labels and high contrast mode
- 🎨 **High Contrast Mode**: Enhanced visibility for better accessibility
- 📊 **Watch History**: Auto-resume from where you left off
- ⭐ **Favorites**: Mark and organize your favorite content
- 🔍 **Advanced Search**: Real-time search with debouncing
- 📈 **Virtual Scrolling**: Handles 1000+ items smoothly
- 🦴 **Skeleton Loaders**: Better loading UX

## 🏗️ Architecture

### Platforms

| Platform | Status | Technology | Progress |
|----------|--------|------------|----------|
| **Desktop** | ✅ Complete | Electron + React + TypeScript | 100% |
| **Tizen TV** | 📋 Planned | Web App + React | 0% |
| **Android** | 📋 Planned | Flutter | 0% |

### Core Technologies

- **Parser**: Rust (compiled to WASM for web, FFI for native)
- **Database**:
  - Desktop: better-sqlite3 (native SQLite)
  - Tizen: sql.js (WASM SQLite) - planned
  - Android: drift + rusqlite - planned
- **UI Framework**: React 19 + TypeScript
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Network**: WebSocket (ws package) for P2P control
- **Build Tool**: Vite + Electron Forge

## 📁 Project Structure

```
zenith-tv/
├── core/
│   └── parser/              # Rust M3U parser (WASM)
│       ├── src/
│       └── pkg/             # WASM output
├── shared/
│   ├── types/               # TypeScript type definitions
│   ├── protocol/            # WebSocket protocol
│   └── ui/                  # Shared React components & stores
└── apps/
    ├── desktop/             # Electron app (✅ 100%)
    │   ├── electron/        # Main process
    │   │   ├── main.js
    │   │   ├── preload.js
    │   │   ├── database.js
    │   │   └── p2p-server.js
    │   └── src/             # Renderer process
    │       ├── components/
    │       ├── stores/
    │       ├── services/
    │       └── types/
    ├── tizen/               # Tizen Web app (📋 Planned)
    └── mobile/              # Flutter app (📋 Planned)
```

## 🚀 Getting Started

### Prerequisites

#### For Desktop App

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Rust** >= 1.75.0 (for building the M3U parser)
- **wasm-pack** (for WASM builds)

#### Optional (for development)

- **Git** (for version control)
- **VS Code** (recommended IDE)

### System Requirements

#### Desktop App

- **Operating System**: Windows 10+, macOS 10.13+, Linux (Ubuntu 18.04+, Fedora 32+)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB for application + cache
- **Network**: Internet connection for M3U playlist syncing

## 📥 Installation

### Desktop App - Complete Setup Guide

#### Step 1: Install Prerequisites

**On Ubuntu/Debian:**
```bash
# Install Node.js 18+ and pnpm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

**On macOS:**
```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js and pnpm
brew install node@18 pnpm

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install wasm-pack
brew install wasm-pack
```

**On Windows:**
```powershell
# Install using winget (Windows Package Manager)
winget install OpenJS.NodeJS.LTS
winget install pnpm.pnpm
winget install Rustlang.Rustup

# Install wasm-pack
cargo install wasm-pack
```

#### Step 2: Clone the Repository

```bash
git clone https://github.com/myniqx/zenith-tv.git
cd zenith-tv
```

#### Step 3: Install Dependencies

```bash
# Install all workspace dependencies
pnpm install
```

#### Step 4: Build the Rust M3U Parser

```bash
# Build the Rust parser to WASM
cd core/parser
wasm-pack build --target web --release
cd ../..

# Or use the npm script from root
pnpm build:parser
```

#### Step 5: Run the Desktop App

```bash
# Development mode with hot reload
pnpm dev:desktop

# Or navigate to desktop app folder
cd apps/desktop
pnpm dev
```

The app will launch automatically in a new window.

#### Step 6: Build for Production

```bash
# Build the desktop app for your current platform
cd apps/desktop
pnpm build

# The built app will be in apps/desktop/out/
```

**Platform-specific builds:**
```bash
# Build for all platforms (requires platform-specific tools)
pnpm make

# Build for specific platform
pnpm make --platform=win32
pnpm make --platform=darwin
pnpm make --platform=linux
```

### First Run Setup

1. **Launch the app** - On first launch, you'll see the Profile Manager
2. **Add a profile** - Click "Add Profile" and enter:
   - Profile name (e.g., "My IPTV")
   - M3U playlist URL
3. **Sync content** - Click "Sync" to download and parse the playlist
4. **Start watching** - Browse categories and click any item to play

### P2P Remote Control Setup

1. **Server automatically starts** on port 8080 when the app launches
2. **Connect from another device**:
   - Connect to the same network
   - Use WebSocket client to connect to `ws://<desktop-ip>:8080`
   - Send a pairing request (4-digit PIN will be shown)
3. **Accept pairing** - Enter the PIN on the desktop app
4. **Control playback** - Send commands from the remote device

## 🛠️ Development

### Available Scripts

```bash
# Root workspace commands
pnpm install              # Install all dependencies
pnpm build:parser         # Build Rust parser to WASM
pnpm dev:desktop          # Run desktop app in dev mode
pnpm lint                 # Lint all packages
pnpm format               # Format code with Prettier

# Desktop app commands (from apps/desktop/)
pnpm dev                  # Start dev server
pnpm build                # Build for production
pnpm make                 # Package app for distribution
pnpm start                # Start built app
pnpm lint                 # Lint code
pnpm type-check           # TypeScript type checking
```

### Project Commands

```bash
# Development workflow
pnpm install              # Install dependencies
pnpm build:parser         # Build Rust → WASM parser
pnpm dev:desktop          # Start desktop app

# Building for production
cd apps/desktop
pnpm build                # Build renderer and main
pnpm make                 # Create distributable package

# Tizen app (planned)
pnpm dev:tizen           # Start Tizen dev server
pnpm build:tizen         # Build Tizen web app

# Android app (planned)
flutter run              # Run on Android device/emulator
flutter build apk        # Build APK
```

### Development Tips

1. **Hot Reload**: The desktop app supports hot reload for UI changes
2. **DevTools**: Press `Ctrl+Shift+I` (or `Cmd+Option+I` on macOS) to open Chrome DevTools
3. **Database**: SQLite database is stored in `~/.config/zenith-tv/` on Linux/macOS, `%APPDATA%/zenith-tv/` on Windows
4. **Logs**: Console logs are visible in DevTools
5. **Parser Changes**: If you modify the Rust parser, rebuild it with `pnpm build:parser`

### Debugging

**Desktop App:**
```bash
# Enable verbose logging
DEBUG=* pnpm dev

# Check database
sqlite3 ~/.config/zenith-tv/zenith.db
.tables
.schema
```

**Parser Issues:**
```bash
# Test parser directly
cd core/parser
cargo test
wasm-pack test --node
```

## 📖 Usage Guide

### Adding M3U Playlists

1. Click the **Profiles** button in the header
2. Click **Add Profile**
3. Enter a name and your M3U playlist URL
4. Click **Add** and then **Sync** to download content

### Navigating Content

- **Categories**: Use the sidebar to filter by Movies, Series, Live TV, Favorites, or Recent
- **Search**: Press `Ctrl+F` or click the search bar to search by title or group
- **Sort**: Use the sort dropdown to organize by Name, Date, or Recently Watched
- **Keyboard**: Use arrow keys to navigate the grid, Enter to play

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause |
| `F` | Toggle Fullscreen |
| `M` | Mute/Unmute |
| `K` | Play/Pause (alternative) |
| `←` / `→` | Seek -10s / +10s (in player) |
| `↑` / `↓` / `←` / `→` | Navigate grid |
| `Enter` | Play selected item |
| `Tab` / `Shift+Tab` | Navigate UI elements |
| `Home` / `End` | Jump to first/last item |
| `Ctrl+F` | Focus search |

### Settings

Access settings by clicking the gear icon in the header:

- **Appearance**: Theme, Language, High Contrast Mode
- **Content**: Default category, Auto-sync interval
- **Player**: Default volume, Auto-resume, Auto-play next episode
- **Network**: P2P server settings (port, device name)

### P2P Remote Control

**WebSocket Protocol:**

```javascript
// Connect
const ws = new WebSocket('ws://192.168.1.100:8080');

// Discover device
ws.send(JSON.stringify({
  type: 'discover',
  deviceName: 'My Phone'
}));

// Request pairing
ws.send(JSON.stringify({
  type: 'pair_request',
  deviceId: 'unique-device-id',
  deviceName: 'My Phone'
}));
// Response: { type: 'pair_response', pin: '1234' }

// Send commands (after paired)
ws.send(JSON.stringify({ type: 'play', item: {...} }));
ws.send(JSON.stringify({ type: 'pause' }));
ws.send(JSON.stringify({ type: 'seek', position: 120 }));
ws.send(JSON.stringify({ type: 'set_volume', volume: 0.8 }));

// Receive state updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'state_update') {
    console.log('Current state:', data.state);
  }
};
```

## 🎯 Roadmap

### ✅ Phase 1: Core & Desktop (Complete)
- ✅ Project structure
- ✅ Rust M3U parser with WASM
- ✅ Episode detection (S01E01, 1x01, etc.)
- ✅ Desktop app UI
- ✅ SQLite integration with better-sqlite3
- ✅ Video player with HTML5
- ✅ Profile management
- ✅ Content categorization
- ✅ Search and filtering
- ✅ Favorites and watch history

### ✅ Phase 2: UX & Performance (Complete)
- ✅ Settings panel
- ✅ Toast notifications
- ✅ Loading states and skeleton loaders
- ✅ Virtual scrolling
- ✅ M3U caching
- ✅ Performance optimizations

### ✅ Phase 3: P2P & Accessibility (Complete)
- ✅ WebSocket P2P server
- ✅ PIN-based device pairing
- ✅ Remote control commands
- ✅ State synchronization
- ✅ Pairing dialog UI
- ✅ Keyboard navigation
- ✅ ARIA labels (comprehensive)
- ✅ High contrast mode

### 📋 Phase 4: Tizen TV (Planned)
- [ ] Tizen Web app project setup
- [ ] sql.js database integration
- [ ] AVPlay API integration
- [ ] D-pad navigation
- [ ] TV-optimized layout
- [ ] Remote control mapping
- [ ] P2P client implementation
- [ ] Tizen packaging (.wgt)

### 📋 Phase 5: Android (Planned)
- [ ] Flutter project setup
- [ ] Rust FFI bindings
- [ ] drift + rusqlite integration
- [ ] ExoPlayer integration
- [ ] Adaptive layouts (phone/tablet/TV)
- [ ] Material 3 Design
- [ ] P2P client implementation
- [ ] Google Play distribution

## 🔧 Troubleshooting

### Common Issues

**Parser build fails:**
```bash
# Make sure Rust and wasm-pack are installed
rustup --version
wasm-pack --version

# Update Rust
rustup update

# Clean and rebuild
cd core/parser
cargo clean
wasm-pack build --target web --release
```

**App won't start:**
```bash
# Clear node modules and reinstall
rm -rf node_modules apps/desktop/node_modules
pnpm install

# Rebuild native modules
cd apps/desktop
pnpm rebuild
```

**Database errors:**
```bash
# Reset database (WARNING: deletes all data)
rm ~/.config/zenith-tv/zenith.db

# Or on Windows:
# del %APPDATA%\zenith-tv\zenith.db
```

**P2P server not starting:**
- Check if port 8080 is available
- Try changing the port in Settings
- Check firewall settings

## 🤝 Contributing

Contributions are welcome! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) before submitting PRs.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `pnpm test`
5. Lint: `pnpm lint`
6. Commit: `git commit -m "feat: add my feature"`
7. Push: `git push origin feature/my-feature`
8. Open a Pull Request

### Code Style

- TypeScript for all new code
- ESLint + Prettier for formatting
- Follow existing patterns
- Add JSDoc comments for public APIs
- Write tests for new features

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with ❤️ using:

- [Rust](https://www.rust-lang.org/) - High-performance M3U parser
- [React](https://react.dev/) - UI framework
- [Electron](https://www.electronjs.org/) - Desktop app framework
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Fast SQLite
- [ws](https://github.com/websockets/ws) - WebSocket implementation
- [Vite](https://vitejs.dev/) - Build tool

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/myniqx/zenith-tv/issues)
- **Discussions**: [GitHub Discussions](https://github.com/myniqx/zenith-tv/discussions)
- **Documentation**: [Wiki](https://github.com/myniqx/zenith-tv/wiki)

## 📊 Project Status

| Component | Status | Version |
|-----------|--------|---------|
| Desktop App | ✅ Complete | 1.0.0 |
| Rust Parser | ✅ Complete | 1.0.0 |
| P2P Server | ✅ Complete | 1.0.0 |
| Tizen App | 📋 Planned | - |
| Android App | 📋 Planned | - |

---

Made with 💜 by [myniqx](https://github.com/myniqx)
