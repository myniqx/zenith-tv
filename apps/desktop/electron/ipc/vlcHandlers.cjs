/**
 * VLC Player IPC Handlers
 *
 * Handles communication between renderer process and native libVLC addon.
 */

const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');

let vlcModule = null;
let player = null;
let loadError = null;

/**
 * Try to load the VLC native module
 */
function loadVlcModule() {
  if (vlcModule) return vlcModule;
  if (loadError) return null;

  try {
    // Try multiple paths for the VLC module
    const possiblePaths = [
      // Workspace package (development)
      path.join(__dirname, '../../../../core/vlc-player'),
      // Packaged app
      path.join(process.resourcesPath || __dirname, 'vlc-player'),
    ];

    for (const modulePath of possiblePaths) {
      try {
        vlcModule = require(modulePath);
        console.log('[VLC] Module loaded from:', modulePath);
        return vlcModule;
      } catch (e) {
        // Try next path
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

  // Initialize player with window handle
  ipcMain.handle('vlc:init', async () => {
    const vlcPlayer = getPlayer();
    if (!vlcPlayer) {
      return { success: false, error: 'VLC module not available' };
    }

    try {
      // Get native window handle from main window
      const handle = mainWindow.getNativeWindowHandle();
      vlcPlayer.setWindow(handle);

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
