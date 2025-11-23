#!/usr/bin/env node

/**
 * VLC SDK Download Script
 *
 * Downloads and extracts VLC SDK for the specified platform(s).
 * Auto-detects current platform if no argument provided.
 *
 * Usage:
 *   node download-vlc-sdk.js          # Download for current platform
 *   node download-vlc-sdk.js win32    # Download for Windows
 *   node download-vlc-sdk.js linux    # Download for Linux
 *   node download-vlc-sdk.js darwin   # Download for macOS
 *   node download-vlc-sdk.js all      # Download for all platforms
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// VLC version to download
const VLC_VERSION = '3.0.20';

// Download URLs for each platform
// IMPORTANT: Use 7z package, not ZIP! Only 7z contains the SDK folder with headers and .lib files
const DOWNLOAD_URLS = {
  win32: {
    binary: `https://download.videolan.org/pub/videolan/vlc/${VLC_VERSION}/win64/vlc-${VLC_VERSION}-win64.7z`,
    description: 'Windows 64-bit',
  },
  linux: {
    binary: null,
    description: 'Linux (use system package manager)',
  },
  darwin: {
    binary: `https://download.videolan.org/pub/videolan/vlc/${VLC_VERSION}/macosx/vlc-${VLC_VERSION}-intel64.dmg`,
    description: 'macOS Intel 64-bit',
  },
};


const LIB_DIR = path.join(__dirname, '..', 'lib');
const TEMP_DIR = path.join(os.tmpdir(), 'vlc-sdk-download');

/**
 * Detect current platform
 */
function detectPlatform() {
  const platform = process.platform;
  if (platform === 'win32') return 'win32';
  if (platform === 'linux') return 'linux';
  if (platform === 'darwin') return 'darwin';
  throw new Error(`Unsupported platform: ${platform}`);
}

/**
 * Download file with progress
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);

    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(destPath); } catch { }
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch { }
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      let lastProgress = 0;

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize > 1024 * 1024) { // Only show progress for large files
          const progress = Math.round((downloadedSize / totalSize) * 100);
          if (progress >= lastProgress + 5) {
            process.stdout.write(`\rProgress: ${progress}% (${(downloadedSize / 1024 / 1024).toFixed(1)} MB)`);
            lastProgress = progress;
          }
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        if (totalSize > 1024 * 1024) {
          console.log('\nDownload complete!');
        }
        resolve(destPath);
      });
    });

    request.on('error', (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch { }
      reject(err);
    });
  });
}


/**
 * Extract archive file (7z or ZIP)
 */
function extractArchive(archivePath, destDir) {
  const ext = path.extname(archivePath).toLowerCase();
  console.log(`Extracting ${ext} to: ${destDir}`);

  if (ext === '.7z') {
    // Try different 7z extraction methods
    const methods = [
      // 7-Zip command line
      () => execSync(`7z x -y "${archivePath}" -o"${destDir}"`, { stdio: 'inherit' }),
      // PowerShell with 7Zip4Powershell module
      () => execSync(`powershell -Command "Expand-7Zip -ArchiveFileName '${archivePath}' -TargetPath '${destDir}'"`, { stdio: 'inherit' }),
    ];

    for (const method of methods) {
      try {
        method();
        return;
      } catch {
        continue;
      }
    }

    // If all methods fail, show instructions
    console.error('\n❌ Could not extract 7z file automatically.');
    console.error('Please install 7-Zip and add it to PATH, or extract manually:');
    console.error(`  Archive: ${archivePath}`);
    console.error(`  Extract to: ${destDir}`);
    console.error('\nAfter extracting, run this script again with --force\n');
    process.exit(1);
  } else {
    // ZIP extraction
    if (process.platform === 'win32') {
      execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`, {
        stdio: 'inherit',
      });
    } else {
      execSync(`unzip -o "${archivePath}" -d "${destDir}"`, { stdio: 'inherit' });
    }
  }
}


/**
 * Setup Windows SDK
 * Downloads VLC 7z package which contains SDK folder with headers and .lib files
 */
async function setupWindows() {
  const platformDir = path.join(LIB_DIR, 'win32');
  const sdkDir = path.join(platformDir, 'sdk');

  // Create directories
  fs.mkdirSync(platformDir, { recursive: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const archivePath = path.join(TEMP_DIR, `vlc-${VLC_VERSION}-win64.7z`);
  const extractDir = path.join(TEMP_DIR, 'vlc-extracted-7z');

  // Download VLC 7z if not cached
  if (!fs.existsSync(archivePath)) {
    await downloadFile(DOWNLOAD_URLS.win32.binary, archivePath);
  } else {
    console.log('Using cached download:', archivePath);
  }

  // Extract
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(extractDir, { recursive: true });
  extractArchive(archivePath, extractDir);

  // Find extracted VLC folder
  const vlcFolder = fs.readdirSync(extractDir).find(f => f.startsWith('vlc-'));
  if (!vlcFolder) {
    throw new Error('Could not find VLC folder in extracted archive');
  }

  const vlcPath = path.join(extractDir, vlcFolder);

  // Verify SDK folder exists (only in 7z, not in ZIP!)
  const sdkSrc = path.join(vlcPath, 'sdk');
  if (!fs.existsSync(sdkSrc)) {
    throw new Error('SDK folder not found! Make sure you downloaded the 7z package, not ZIP.');
  }

  // Copy SDK folder (includes headers and .lib files)
  console.log('Copying SDK...');
  if (fs.existsSync(sdkDir)) {
    fs.rmSync(sdkDir, { recursive: true, force: true });
  }
  copyDir(sdkSrc, sdkDir);
  console.log('  SDK copied (headers + lib files)');

  // Copy DLLs to platform root
  console.log('Copying DLLs...');
  const dllsToCopy = ['libvlc.dll', 'libvlccore.dll'];
  for (const dll of dllsToCopy) {
    const src = path.join(vlcPath, dll);
    const dest = path.join(platformDir, dll);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`  Copied: ${dll}`);
    }
  }

  // Copy plugins folder
  console.log('Copying plugins...');
  const pluginsSrc = path.join(vlcPath, 'plugins');
  const pluginsDest = path.join(platformDir, 'plugins');
  if (fs.existsSync(pluginsDest)) {
    fs.rmSync(pluginsDest, { recursive: true, force: true });
  }
  if (fs.existsSync(pluginsSrc)) {
    copyDir(pluginsSrc, pluginsDest);
    const pluginCount = countFiles(pluginsDest);
    console.log(`  Plugins copied! (${pluginCount} files)`);
  }

  console.log('\n✓ Windows SDK setup complete!');
  console.log(`  Location: ${platformDir}`);
  console.log(`  DLLs: libvlc.dll, libvlccore.dll`);
  console.log(`  SDK: ${sdkDir}`);
  console.log(`  Plugins: ${pluginsDest}`);
}

/**
 * Setup Linux (instructions only)
 */
async function setupLinux() {
  const platformDir = path.join(LIB_DIR, 'linux');
  fs.mkdirSync(platformDir, { recursive: true });

  console.log('\n=== Linux VLC SDK Setup ===\n');
  console.log('Linux uses system-installed VLC libraries.');
  console.log('Please install VLC development packages:\n');
  console.log('  Ubuntu/Debian:');
  console.log('    sudo apt update');
  console.log('    sudo apt install libvlc-dev vlc\n');
  console.log('  Fedora:');
  console.log('    sudo dnf install vlc-devel vlc\n');
  console.log('  Arch Linux:');
  console.log('    sudo pacman -S vlc\n');

  fs.writeFileSync(
    path.join(platformDir, 'README.txt'),
    `Linux VLC SDK Setup
====================

Linux uses system-installed VLC libraries.
Install the development packages:

Ubuntu/Debian:
  sudo apt install libvlc-dev vlc

Fedora:
  sudo dnf install vlc-devel vlc

Arch Linux:
  sudo pacman -S vlc

The binding.gyp is configured to use system headers from /usr/include/vlc
and link against the system libvlc.
`
  );

  console.log('✓ Linux setup instructions created!');
}

/**
 * Setup macOS
 */
async function setupDarwin() {
  const platformDir = path.join(LIB_DIR, 'darwin');
  fs.mkdirSync(platformDir, { recursive: true });

  console.log('\n=== macOS VLC SDK Setup ===\n');
  console.log('For macOS, you have two options:\n');
  console.log('Option 1: Install VLC via Homebrew (recommended for development)');
  console.log('  brew install vlc\n');
  console.log('Option 2: Download VLC.app from videolan.org');
  console.log('  The framework will be at /Applications/VLC.app/Contents/MacOS/\n');

  fs.writeFileSync(
    path.join(platformDir, 'README.txt'),
    `macOS VLC SDK Setup
====================

Option 1: Homebrew (recommended for development)
  brew install vlc

Option 2: Download VLC.app
  Download from https://www.videolan.org/vlc/
  Install to /Applications/VLC.app

The binding.gyp is configured to use:
  Include: /Applications/VLC.app/Contents/MacOS/include
  Library: /Applications/VLC.app/Contents/MacOS/lib

For distribution, you'll need to bundle the VLC.framework
with your application.
`
  );

  console.log('✓ macOS setup instructions created!');
}

/**
 * Recursively copy directory
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Count files in directory recursively
 */
function countFiles(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

/**
 * Check if SDK is already set up for a platform
 */
function isSdkSetup(platform) {
  const platformDir = path.join(LIB_DIR, platform);

  if (platform === 'win32') {
    const dllExists = fs.existsSync(path.join(platformDir, 'libvlc.dll'));
    const headersExist = fs.existsSync(path.join(platformDir, 'sdk', 'include', 'vlc', 'libvlc.h'));
    return dllExists && headersExist;
  }

  if (platform === 'linux' || platform === 'darwin') {
    return fs.existsSync(path.join(platformDir, 'README.txt'));
  }

  return false;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let platforms = [];
  let forceDownload = args.includes('--force') || args.includes('-f');

  const filteredArgs = args.filter(a => !a.startsWith('-'));

  if (filteredArgs.length === 0) {
    platforms = [detectPlatform()];
    console.log(`Auto-detected platform: ${platforms[0]}`);
  } else if (filteredArgs[0] === 'all') {
    platforms = ['win32', 'linux', 'darwin'];
  } else {
    platforms = filteredArgs.filter(p => ['win32', 'linux', 'darwin'].includes(p));
    if (platforms.length === 0) {
      console.error('Invalid platform. Use: win32, linux, darwin, or all');
      process.exit(1);
    }
  }

  // Check if already set up
  if (!forceDownload) {
    const alreadySetup = platforms.filter(p => isSdkSetup(p));
    if (alreadySetup.length === platforms.length) {
      console.log('\n✓ VLC SDK already set up for all requested platforms.');
      console.log('  Use --force to re-download.\n');
      process.exit(0);
    }
    platforms = platforms.filter(p => !isSdkSetup(p));
  }

  console.log(`\n=== VLC SDK Downloader v${VLC_VERSION} ===\n`);
  console.log(`Platforms to setup: ${platforms.join(', ')}\n`);

  for (const platform of platforms) {
    console.log(`\n--- Setting up ${DOWNLOAD_URLS[platform].description} ---\n`);

    try {
      switch (platform) {
        case 'win32':
          await setupWindows();
          break;
        case 'linux':
          await setupLinux();
          break;
        case 'darwin':
          await setupDarwin();
          break;
      }
    } catch (error) {
      console.error(`\n✗ Error setting up ${platform}:`, error.message);
      if (platforms.length === 1) {
        process.exit(1);
      }
    }
  }

  console.log('\n=== Setup Complete ===\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
}).finally(() => {
  process.exit(0);
});
