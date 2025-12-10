#!/bin/bash

# Universal build script for VLC player native addon
# Supports Windows (Git Bash/MSYS2), Linux, and macOS

set -e  # Exit on error

COMMAND=$1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect platform
detect_platform() {
    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*)
            echo "win32"
            ;;
        Linux*)
            echo "linux"
            ;;
        Darwin*)
            echo "darwin"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# Detect architecture (use node-gyp's detected arch as it's more reliable)
detect_arch() {
    # Try to get from node process
    if command -v node &> /dev/null; then
        local node_arch=$(node -p "process.arch")
        case "$node_arch" in
            x64)
                echo "x64"
                return
                ;;
            arm64)
                echo "arm64"
                return
                ;;
        esac
    fi

    # Fallback to uname
    local arch=$(uname -m)
    case "$arch" in
        x86_64|amd64)
            echo "x64"
            ;;
        aarch64|arm64)
            echo "arm64"
            ;;
        *)
            echo "$arch"
            ;;
    esac
}

# Get platform-specific lib directory name
get_lib_dir() {
    local platform=$1
    local arch=$2

    if [ "$platform" = "win32" ] && [ "$arch" = "arm64" ]; then
        echo "win32-arm64"
    else
        echo "$platform"
    fi
}

PLATFORM=$(detect_platform)
ARCH=$(detect_arch)
LIB_DIR=$(get_lib_dir "$PLATFORM" "$ARCH")

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Clean build directory
clean_build() {
    log_info "Cleaning build directory..."
    cd "$PROJECT_DIR"

    if [ -d "build" ]; then
        rm -rf build
        log_info "Build directory removed"
    else
        log_warn "Build directory does not exist, skipping"
    fi
}

# Download VLC SDK
download_sdk() {
    log_info "Downloading VLC SDK for platform: $PLATFORM, arch: $ARCH"
    cd "$PROJECT_DIR"

    # Check if SDK already exists
    if [ -d "lib/$LIB_DIR/sdk" ]; then
        log_info "VLC SDK already exists, skipping download"
        return 0
    fi

    node scripts/download-vlc-sdk.js
    log_info "VLC SDK downloaded successfully"
}

# Configure node-gyp
configure() {
    log_info "Configuring node-gyp..."
    cd "$PROJECT_DIR"
    node-gyp configure
    log_info "Configuration complete"
}

# Build native addon
build_addon() {
    log_info "Building native addon..."
    cd "$PROJECT_DIR"
    node-gyp build
    log_info "Build complete"
}

# Copy VLC plugins (Windows only)
copy_plugins() {
    if [ "$PLATFORM" != "win32" ]; then
        log_info "Skipping plugins copy (not Windows)"
        return 0
    fi

    log_info "Checking VLC plugins for $LIB_DIR..."
    cd "$PROJECT_DIR"

    local BUILD_DIR="build/Release"
    local PLUGINS_SRC="lib/$LIB_DIR/plugins"
    local PLUGINS_DEST="$BUILD_DIR/plugins"

    # Check if build directory exists
    if [ ! -d "$BUILD_DIR" ]; then
        log_error "Build directory not found: $BUILD_DIR"
        return 1
    fi

    # Check if plugins already copied
    if [ -d "$PLUGINS_DEST" ]; then
        log_info "Plugins already exist in build directory, skipping copy"
        return 0
    fi

    # Check if source plugins exist
    if [ ! -d "$PLUGINS_SRC" ]; then
        log_error "Source plugins directory not found: $PLUGINS_SRC"
        return 1
    fi

    log_info "Copying VLC plugins from $PLUGINS_SRC to $PLUGINS_DEST..."

    # Use cp -r (works in Git Bash on Windows)
    cp -r "$PLUGINS_SRC" "$PLUGINS_DEST"

    if [ $? -eq 0 ]; then
        log_info "Plugins copied successfully"
    else
        log_error "Failed to copy plugins"
        return 1
    fi
}

# Rebuild (clean + configure + build + copy plugins)
rebuild() {
    clean_build
    configure
    build_addon
    copy_plugins
}

# Full install (download SDK + rebuild)
install() {
    download_sdk
    rebuild
}

# Postinstall - only copy plugins after node-gyp rebuild
postinstall() {
    log_info "Running postinstall..."
    copy_plugins
}

# Show usage
usage() {
    echo "Usage: $0 {clean|configure|build|rebuild|install|postinstall}"
    echo ""
    echo "Commands:"
    echo "  clean       - Remove build directory"
    echo "  configure   - Run node-gyp configure"
    echo "  build       - Build native addon and copy plugins (Windows)"
    echo "  rebuild     - Clean + configure + build"
    echo "  install     - Download SDK + rebuild"
    echo "  postinstall - Copy plugins only (after node-gyp rebuild)"
    echo ""
    echo "Platform detected: $PLATFORM"
    echo "Architecture detected: $ARCH"
    echo "Library directory: $LIB_DIR"
}

# Main command dispatcher
case "$COMMAND" in
    clean)
        clean_build
        ;;
    configure)
        configure
        ;;
    build)
        build_addon
        copy_plugins
        ;;
    rebuild)
        rebuild
        ;;
    install)
        install
        ;;
    postinstall)
        postinstall
        ;;
    *)
        usage
        exit 1
        ;;
esac

log_info "Done!"
exit 0
