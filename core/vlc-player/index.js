/**
 * @zenith-tv/vlc-player - Native libVLC bindings for Electron
 *
 * This module provides a JavaScript wrapper around the native VLC addon.
 * It handles loading the native module and provides a clean API.
 */

const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

let nativeModule = null;
let loadError = null;

// Try to load the native module
function loadNativeModule() {
  if (nativeModule) return nativeModule;
  if (loadError) throw loadError;

  const possiblePaths = [
    // Development build
    path.join(__dirname, 'build', 'Release', 'vlc_player.node'),
    path.join(__dirname, 'build', 'Debug', 'vlc_player.node'),
    // Production (packaged app)
    path.join(process.resourcesPath || __dirname, 'vlc_player.node'),
  ];

  // Use createRequire to bypass bundler's static analysis
  // This ensures the native .node module is loaded at runtime
  const dynamicRequire = createRequire(__filename);

  for (const modulePath of possiblePaths) {
    try {
      if (fs.existsSync(modulePath)) {
        nativeModule = dynamicRequire(modulePath);
        return nativeModule;
      }
    } catch (err) {
      // Continue to next path
    }
  }

  loadError = new Error(
    'Failed to load native vlc_player module. ' +
      'Make sure libVLC is installed and the module is built. ' +
      `Searched paths: ${possiblePaths.join(', ')}`
  );
  throw loadError;
}

/**
 * Check if the native VLC module is available
 * @returns {boolean}
 */
function isAvailable() {
  try {
    loadNativeModule();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the VlcPlayer class
 * @returns {typeof import('./index').VlcPlayer}
 */
function getVlcPlayer() {
  const native = loadNativeModule();
  return native.VlcPlayer;
}

/**
 * Create a new VlcPlayer instance
 * @returns {import('./index').VlcPlayer}
 */
function createPlayer() {
  const VlcPlayer = getVlcPlayer();
  return new VlcPlayer();
}

module.exports = {
  isAvailable,
  getVlcPlayer,
  createPlayer,
  get VlcPlayer() {
    return getVlcPlayer();
  },
};
