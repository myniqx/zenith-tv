/**
 * VLC Player IPC Handlers
 *
 * Handles communication between renderer process and native libVLC addon.
 */

const { ipcMain, BrowserWindow, app } = require('electron');
const path = require('path');
const fs = require('fs');

let vlcModule = null;
let player = null;
let loadError = null;

/**
 * Find the workspace root directory
 * Works both in development (electron-vite) and production (packaged)
 */
function findWorkspaceRoot() {
  // In development, app.getAppPath() returns the desktop app directory
  // e.g., /home/user/react-projects/zenith-tv/apps/desktop
  const appPath = app.getAppPath();

  // Check if we're in the monorepo structure
  const possibleRoots = [
    path.join(appPath, '../..'),           // From apps/desktop -> root
    path.join(appPath, '../../..'),        // From out/main -> root (bundled)
    process.cwd(),                          // Current working directory
  ];

  for (const root of possibleRoots) {
    const vlcPlayerPath = path.join(root, 'core/vlc-player');
    if (fs.existsSync(vlcPlayerPath)) {
      return root;
    }
  }

  return null;
}

/**
 * Try to load the VLC native module
 */
function loadVlcModule() {
  if (vlcModule) return vlcModule;
  if (loadError) return null;

  try {
    const workspaceRoot = findWorkspaceRoot();

    // Build list of possible paths
    const possiblePaths = [];

    // Development: workspace root path
    if (workspaceRoot) {
      possiblePaths.push(path.join(workspaceRoot, 'core/vlc-player'));
    }

    // Packaged app: resources directory
    if (process.resourcesPath) {
      possiblePaths.push(path.join(process.resourcesPath, 'vlc-player'));
    }

    for (const modulePath of possiblePaths) {
      try {
        if (fs.existsSync(modulePath)) {
          // Use createRequire to bypass Rollup's static analysis
          // This ensures the native module is loaded at runtime, not bundled
          const { createRequire } = require('module');
          const dynamicRequire = createRequire(__filename);
          vlcModule = dynamicRequire(modulePath);
          console.log('[VLC] Module loaded from:', modulePath);
          return vlcModule;
        }
      } catch (e) {
        console.log('[VLC] Failed to load from', modulePath, ':', e.message);
      }
    }

    throw new Error('VLC module not found in any expected location');
  } catch (error) {
    loadError = error;
    console.warn('[VLC] Failed to load VLC module:', error.message);
    return null;
  }
}

/**
 * Get or create VLC player instance
 */
function getPlayer() {
  if (player) return player;

  const vlc = loadVlcModule();
  if (!vlc || !vlc.isAvailable()) {
    return null;
  }

  try {
    player = vlc.createPlayer();
    console.log('[VLC] Player instance created');
    return player;
  } catch (error) {
    console.error('[VLC] Failed to create player:', error);
    return null;
  }
}

/**
 * Register VLC IPC handlers
 */
function registerVlcHandlers(mainWindow) {
  // Check if VLC is available
  ipcMain.handle('vlc:isAvailable', async () => {
    const vlc = loadVlcModule();
    return vlc ? vlc.isAvailable() : false;
  });

  // Initialize player (just sets up event forwarding, no window yet)
  ipcMain.handle('vlc:init', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) {
      return { success: false, error: 'VLC module not available' };
    }

    try {
      // Set up event forwarding to renderer
      vlcPlayer.on('timeChanged', (time) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vlc:timeChanged', time);
        }
      });

      vlcPlayer.on('stateChanged', (state) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vlc:stateChanged', state);
        }
      });

      vlcPlayer.on('endReached', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vlc:endReached');
        }
      });

      vlcPlayer.on('error', (message) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vlc:error', message);
        }
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Create child window for VLC rendering
  ipcMain.handle('vlc:createChildWindow', async (_, x, y, width, height) => {
    console.log('[VLC] createChildWindow called with:', { x, y, width, height });

    const vlcPlayer = getPlayer();
    if (!vlcPlayer) {
      console.error('[VLC] createChildWindow: VLC player not available');
      return { success: false, error: 'VLC module not available' };
    }

    try {
      // Get native window handle from main window
      const handleBuffer = mainWindow.getNativeWindowHandle();
      console.log('[VLC] Got native window handle buffer, length:', handleBuffer.length);

      // Convert handle based on platform
      let handle;
      if (process.platform === 'linux') {
        // X11 Window ID can be 32-bit or 64-bit depending on the system/Electron version
        if (handleBuffer.length === 8) {
          handle = handleBuffer.readBigUInt64LE(0);
          console.log('[VLC] Linux X11 Window ID (64-bit):', handle.toString(), '(hex: 0x' + handle.toString(16) + ')');
        } else if (handleBuffer.length === 4) {
          // Read as 32-bit and convert to BigInt for consistency
          handle = BigInt(handleBuffer.readUInt32LE(0));
          console.log('[VLC] Linux X11 Window ID (32-bit):', handle.toString(), '(hex: 0x' + handle.toString(16) + ')');
        } else {
          console.warn('[VLC] Unexpected handle buffer length:', handleBuffer.length);
          // Try to read as much as possible or fallback
          handle = BigInt(0);
        }
      } else {
        // Windows/macOS: Pass buffer directly
        handle = handleBuffer;
        console.log('[VLC] Windows/macOS handle buffer');
      }

      console.log('[VLC] Calling native createChildWindow...');
      const result = vlcPlayer.createChildWindow(handle, x, y, width, height);
      console.log('[VLC] Native createChildWindow returned:', result);

      return { success: result };
    } catch (error) {
      console.error('[VLC] CreateChildWindow error:', error);
      console.error('[VLC] Error stack:', error.stack);
      return { success: false, error: error.message };
    }
  });

  // Destroy child window
  ipcMain.handle('vlc:destroyChildWindow', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return { success: false };

    try {
      const result = vlcPlayer.destroyChildWindow();
      return { success: result };
    } catch (error) {
      console.error('[VLC] DestroyChildWindow error:', error);
      return { success: false, error: error.message };
    }
  });

  // Update child window bounds
  ipcMain.handle('vlc:setBounds', async (_, x, y, width, height) => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return false;

    try {
      return vlcPlayer.setBounds(x, y, width, height);
    } catch (error) {
      console.error('[VLC] SetBounds error:', error);
      return false;
    }
  });

  // Show child window
  ipcMain.handle('vlc:showWindow', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return false;

    try {
      return vlcPlayer.showWindow();
    } catch (error) {
      console.error('[VLC] ShowWindow error:', error);
      return false;
    }
  });

  // Hide child window
  ipcMain.handle('vlc:hideWindow', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return false;

    try {
      return vlcPlayer.hideWindow();
    } catch (error) {
      console.error('[VLC] HideWindow error:', error);
      return false;
    }
  });

  // Playback control
  ipcMain.handle('vlc:play', async (_, url) => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return false;

    try {
      return vlcPlayer.play(url);
    } catch (error) {
      console.error('[VLC] Play error:', error);
      return false;
    }
  });

  ipcMain.handle('vlc:pause', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return;

    try {
      vlcPlayer.pause();
    } catch (error) {
      console.error('[VLC] Pause error:', error);
    }
  });

  ipcMain.handle('vlc:resume', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return;

    try {
      vlcPlayer.resume();
    } catch (error) {
      console.error('[VLC] Resume error:', error);
    }
  });

  ipcMain.handle('vlc:stop', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return;

    try {
      vlcPlayer.stop();
    } catch (error) {
      console.error('[VLC] Stop error:', error);
    }
  });

  ipcMain.handle('vlc:seek', async (_, time) => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return;

    try {
      vlcPlayer.seek(time);
    } catch (error) {
      console.error('[VLC] Seek error:', error);
    }
  });

  // Volume control
  ipcMain.handle('vlc:setVolume', async (_, volume) => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return;

    try {
      vlcPlayer.setVolume(volume);
    } catch (error) {
      console.error('[VLC] SetVolume error:', error);
    }
  });

  ipcMain.handle('vlc:getVolume', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return 0;

    try {
      return vlcPlayer.getVolume();
    } catch (error) {
      console.error('[VLC] GetVolume error:', error);
      return 0;
    }
  });

  ipcMain.handle('vlc:setMute', async (_, mute) => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return;

    try {
      vlcPlayer.setMute(mute);
    } catch (error) {
      console.error('[VLC] SetMute error:', error);
    }
  });

  ipcMain.handle('vlc:getMute', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return false;

    try {
      return vlcPlayer.getMute();
    } catch (error) {
      console.error('[VLC] GetMute error:', error);
      return false;
    }
  });

  // Time/Position
  ipcMain.handle('vlc:getTime', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return 0;

    try {
      return vlcPlayer.getTime();
    } catch (error) {
      return 0;
    }
  });

  ipcMain.handle('vlc:getLength', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return 0;

    try {
      return vlcPlayer.getLength();
    } catch (error) {
      return 0;
    }
  });

  ipcMain.handle('vlc:getPosition', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return 0;

    try {
      return vlcPlayer.getPosition();
    } catch (error) {
      return 0;
    }
  });

  ipcMain.handle('vlc:setPosition', async (_, position) => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return;

    try {
      vlcPlayer.setPosition(position);
    } catch (error) {
      console.error('[VLC] SetPosition error:', error);
    }
  });

  // State
  ipcMain.handle('vlc:getState', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return 'idle';

    try {
      return vlcPlayer.getState();
    } catch (error) {
      return 'error';
    }
  });

  ipcMain.handle('vlc:isPlaying', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return false;

    try {
      return vlcPlayer.isPlaying();
    } catch (error) {
      return false;
    }
  });

  ipcMain.handle('vlc:isSeekable', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return false;

    try {
      return vlcPlayer.isSeekable();
    } catch (error) {
      return false;
    }
  });

  // Audio tracks
  ipcMain.handle('vlc:getAudioTracks', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return [];

    try {
      return vlcPlayer.getAudioTracks();
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('vlc:getAudioTrack', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return -1;

    try {
      return vlcPlayer.getAudioTrack();
    } catch (error) {
      return -1;
    }
  });

  ipcMain.handle('vlc:setAudioTrack', async (_, trackId) => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return false;

    try {
      return vlcPlayer.setAudioTrack(trackId);
    } catch (error) {
      console.error('[VLC] SetAudioTrack error:', error);
      return false;
    }
  });

  // Subtitle tracks
  ipcMain.handle('vlc:getSubtitleTracks', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return [];

    try {
      return vlcPlayer.getSubtitleTracks();
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('vlc:getSubtitleTrack', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return -1;

    try {
      return vlcPlayer.getSubtitleTrack();
    } catch (error) {
      return -1;
    }
  });

  ipcMain.handle('vlc:setSubtitleTrack', async (_, trackId) => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return false;

    try {
      return vlcPlayer.setSubtitleTrack(trackId);
    } catch (error) {
      console.error('[VLC] SetSubtitleTrack error:', error);
      return false;
    }
  });

  ipcMain.handle('vlc:setSubtitleDelay', async (_, delay) => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return false;

    try {
      return vlcPlayer.setSubtitleDelay(delay);
    } catch (error) {
      console.error('[VLC] SetSubtitleDelay error:', error);
      return false;
    }
  });

  // Video tracks
  ipcMain.handle('vlc:getVideoTracks', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return [];

    try {
      return vlcPlayer.getVideoTracks();
    } catch (error) {
      return [];
    }
  });

  // Playback rate
  ipcMain.handle('vlc:setRate', async (_, rate) => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return;

    try {
      vlcPlayer.setRate(rate);
    } catch (error) {
      console.error('[VLC] SetRate error:', error);
    }
  });

  ipcMain.handle('vlc:getRate', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) return 1.0;

    try {
      return vlcPlayer.getRate();
    } catch (error) {
      return 1.0;
    }
  });

  console.log('[VLC] IPC handlers registered');
}

/**
 * Cleanup VLC resources
 */
function cleanupVlc() {
  if (player) {
    try {
      player.stop();
      player.dispose();
    } catch (error) {
      console.error('[VLC] Cleanup error:', error);
    }
    player = null;
  }
}

module.exports = {
  registerVlcHandlers,
  cleanupVlc,
};
