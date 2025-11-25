/**
 * VLC Player IPC Handlers (Refactored for Child Process)
 *
 * Handles communication between renderer process and VLC child process.
 * All VLC operations run in an isolated Node.js process to avoid
 * X11/GPU conflicts with Electron/Chromium.
 */

const { ipcMain } = require('electron');
const { VlcProcessManager } = require('../vlc/vlcProcessManager.cjs');
const protocol = require('../vlc/messageProtocol.cjs');

let vlcManager = null;

/**
 * Get or create VLC process manager instance (singleton)
 */
async function getVlcManager() {
  if (vlcManager && vlcManager.isReady()) {
    return vlcManager;
  }

  if (!vlcManager) {
    vlcManager = new VlcProcessManager();
  }

  if (!vlcManager.isReady()) {
    await vlcManager.start();
  }

  return vlcManager;
}

/**
 * Register VLC IPC handlers
 */
function registerVlcHandlers(mainWindow) {
  console.log('[VLC] Registering IPC handlers');

  // Check if VLC is available
  ipcMain.handle('vlc:isAvailable', async () => {
    try {
      const manager = await getVlcManager();
      // Try to initialize to verify it works
      await manager.call(protocol.TO_CHILD.INIT);
      return true;
    } catch (error) {
      console.error('[VLC] Availability check failed:', error);
      return false;
    }
  });

  // Initialize player and setup event forwarding
  ipcMain.handle('vlc:init', async () => {
    try {
      const manager = await getVlcManager();

      // Initialize player in child process
      await manager.call(protocol.TO_CHILD.INIT);

      // Setup event forwarding to renderer
      manager.on('timeChanged', (time) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vlc:timeChanged', time);
        }
      });

      manager.on('stateChanged', (state) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vlc:stateChanged', state);
        }
      });

      manager.on('durationChanged', (duration) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vlc:durationChanged', duration);
        }
      });

      manager.on('positionChanged', (position) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vlc:positionChanged', position);
        }
      });

      manager.on('endReached', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vlc:endReached');
        }
      });

      manager.on('error', (message) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vlc:error', message);
        }
      });

      manager.on('audioVolume', (volume) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vlc:audioVolume', volume);
        }
      });

      // Setup MessagePort for frame transfer (canvas rendering)
      // TODO: Fix MessagePort transfer for child_process (currently only works with Worker Threads)
      let framePort = null;
      try {
        // framePort = manager.setupFramePort();
        console.log('[VLC] MessagePort setup skipped (window mode only)');
      } catch (err) {
        console.warn('[VLC] Failed to setup frame port:', err.message);
      }

      console.log('[VLC] Initialization complete');

      return {
        success: true,
        framePort: framePort
      };
    } catch (error) {
      console.error('[VLC] Initialization failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Window mode: Create child window for VLC rendering
  ipcMain.handle('vlc:createChildWindow', async (_, x, y, width, height) => {
    try {
      const manager = await getVlcManager();

      // Get native window handle from main window
      const handleBuffer = mainWindow.getNativeWindowHandle();

      // Convert handle based on platform
      let handle;
      if (process.platform === 'linux') {
        if (handleBuffer.length === 8) {
          handle = handleBuffer.readBigUInt64LE(0);
        } else if (handleBuffer.length === 4) {
          handle = BigInt(handleBuffer.readUInt32LE(0));
        } else {
          handle = BigInt(0);
        }
      } else {
        // Windows/macOS: Pass buffer directly
        handle = handleBuffer;
      }

      const result = await manager.call(
        protocol.TO_CHILD.CREATE_WINDOW,
        handle,
        x,
        y,
        width,
        height
      );

      return { success: result };
    } catch (error) {
      console.error('[VLC] CreateChildWindow error:', error);
      return { success: false, error: error.message };
    }
  });

  // Window mode: Update child window bounds
  ipcMain.handle('vlc:setBounds', async (_, x, y, width, height) => {
    try {
      const manager = await getVlcManager();
      return await manager.call(protocol.TO_CHILD.RESIZE_WINDOW, x, y, width, height);
    } catch (error) {
      console.error('[VLC] SetBounds error:', error);
      return false;
    }
  });

  // Canvas mode: Setup video callback for frame rendering
  ipcMain.handle('vlc:setupVideoCallback', async (_, width, height) => {
    try {
      const manager = await getVlcManager();
      const result = await manager.call(
        protocol.TO_CHILD.SET_VIDEO_CALLBACK,
        width,
        height
      );
      return result;
    } catch (error) {
      console.error('[VLC] SetupVideoCallback error:', error);
      return { success: false, error: error.message };
    }
  });

  // Playback control
  ipcMain.handle('vlc:play', async (_, url) => {
    try {
      const manager = await getVlcManager();
      return await manager.call(protocol.TO_CHILD.PLAY, url);
    } catch (error) {
      console.error('[VLC] Play error:', error);
      return false;
    }
  });

  ipcMain.handle('vlc:pause', async () => {
    try {
      const manager = await getVlcManager();
      await manager.call(protocol.TO_CHILD.PAUSE);
    } catch (error) {
      console.error('[VLC] Pause error:', error);
    }
  });

  ipcMain.handle('vlc:resume', async () => {
    try {
      const manager = await getVlcManager();
      // VLC doesn't have separate resume, just call pause again to toggle
      await manager.call(protocol.TO_CHILD.PAUSE);
    } catch (error) {
      console.error('[VLC] Resume error:', error);
    }
  });

  ipcMain.handle('vlc:stop', async () => {
    try {
      const manager = await getVlcManager();
      await manager.call(protocol.TO_CHILD.STOP);
    } catch (error) {
      console.error('[VLC] Stop error:', error);
    }
  });

  ipcMain.handle('vlc:seek', async (_, time) => {
    try {
      const manager = await getVlcManager();
      await manager.call(protocol.TO_CHILD.SEEK, time);
    } catch (error) {
      console.error('[VLC] Seek error:', error);
    }
  });

  // Volume control
  ipcMain.handle('vlc:setVolume', async (_, volume) => {
    try {
      const manager = await getVlcManager();
      await manager.call(protocol.TO_CHILD.SET_VOLUME, volume);
    } catch (error) {
      console.error('[VLC] SetVolume error:', error);
    }
  });

  ipcMain.handle('vlc:getVolume', async () => {
    try {
      const manager = await getVlcManager();
      return await manager.call(protocol.TO_CHILD.GET_VOLUME);
    } catch (error) {
      console.error('[VLC] GetVolume error:', error);
      return 0;
    }
  });

  ipcMain.handle('vlc:setMute', async (_, mute) => {
    try {
      const manager = await getVlcManager();
      const volume = mute ? 0 : 100;
      await manager.call(protocol.TO_CHILD.SET_VOLUME, volume);
    } catch (error) {
      console.error('[VLC] SetMute error:', error);
    }
  });

  ipcMain.handle('vlc:getMute', async () => {
    try {
      const manager = await getVlcManager();
      const volume = await manager.call(protocol.TO_CHILD.GET_VOLUME);
      return volume === 0;
    } catch (error) {
      console.error('[VLC] GetMute error:', error);
      return false;
    }
  });

  // Time/Position
  ipcMain.handle('vlc:getTime', async () => {
    try {
      const manager = await getVlcManager();
      return await manager.call(protocol.TO_CHILD.GET_TIME);
    } catch (error) {
      return 0;
    }
  });

  ipcMain.handle('vlc:getLength', async () => {
    try {
      const manager = await getVlcManager();
      return await manager.call(protocol.TO_CHILD.GET_DURATION);
    } catch (error) {
      return 0;
    }
  });

  ipcMain.handle('vlc:getPosition', async () => {
    try {
      const manager = await getVlcManager();
      const time = await manager.call(protocol.TO_CHILD.GET_TIME);
      const duration = await manager.call(protocol.TO_CHILD.GET_DURATION);
      return duration > 0 ? time / duration : 0;
    } catch (error) {
      return 0;
    }
  });

  ipcMain.handle('vlc:setPosition', async (_, position) => {
    try {
      const manager = await getVlcManager();
      const duration = await manager.call(protocol.TO_CHILD.GET_DURATION);
      const time = duration * position;
      await manager.call(protocol.TO_CHILD.SEEK, time);
    } catch (error) {
      console.error('[VLC] SetPosition error:', error);
    }
  });

  // State
  ipcMain.handle('vlc:getState', async () => {
    try {
      const manager = await getVlcManager();
      return await manager.call(protocol.TO_CHILD.GET_STATE);
    } catch (error) {
      return 'error';
    }
  });

  ipcMain.handle('vlc:isPlaying', async () => {
    try {
      const manager = await getVlcManager();
      return await manager.call(protocol.TO_CHILD.IS_PLAYING);
    } catch (error) {
      return false;
    }
  });

  ipcMain.handle('vlc:isSeekable', async () => {
    try {
      const manager = await getVlcManager();
      return await manager.call(protocol.TO_CHILD.IS_SEEKABLE);
    } catch (error) {
      return false;
    }
  });

  // Audio tracks
  ipcMain.handle('vlc:getAudioTracks', async () => {
    try {
      const manager = await getVlcManager();
      return await manager.call(protocol.TO_CHILD.GET_AUDIO_TRACKS);
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('vlc:getAudioTrack', async () => {
    try {
      const manager = await getVlcManager();
      const tracks = await manager.call(protocol.TO_CHILD.GET_AUDIO_TRACKS);
      // Return current track ID (first track by default)
      return tracks.length > 0 ? tracks[0].id : -1;
    } catch (error) {
      return -1;
    }
  });

  ipcMain.handle('vlc:setAudioTrack', async (_, trackId) => {
    try {
      const manager = await getVlcManager();
      return await manager.call(protocol.TO_CHILD.SET_AUDIO_TRACK, trackId);
    } catch (error) {
      console.error('[VLC] SetAudioTrack error:', error);
      return false;
    }
  });

  // Subtitle tracks
  ipcMain.handle('vlc:getSubtitleTracks', async () => {
    try {
      const manager = await getVlcManager();
      return await manager.call(protocol.TO_CHILD.GET_SUBTITLE_TRACKS);
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('vlc:getSubtitleTrack', async () => {
    try {
      const manager = await getVlcManager();
      const tracks = await manager.call(protocol.TO_CHILD.GET_SUBTITLE_TRACKS);
      return tracks.length > 0 ? tracks[0].id : -1;
    } catch (error) {
      return -1;
    }
  });

  ipcMain.handle('vlc:setSubtitleTrack', async (_, trackId) => {
    try {
      const manager = await getVlcManager();
      return await manager.call(protocol.TO_CHILD.SET_SUBTITLE_TRACK, trackId);
    } catch (error) {
      console.error('[VLC] SetSubtitleTrack error:', error);
      return false;
    }
  });

  ipcMain.handle('vlc:setSubtitleDelay', async (_, delay) => {
    try {
      const manager = await getVlcManager();
      return await manager.call(protocol.TO_CHILD.SET_SUBTITLE_DELAY, delay);
    } catch (error) {
      console.error('[VLC] SetSubtitleDelay error:', error);
      return false;
    }
  });

  // Video tracks (kept for compatibility)
  ipcMain.handle('vlc:getVideoTracks', async () => {
    try {
      // Video tracks not exposed in protocol yet, return empty array
      return [];
    } catch (error) {
      return [];
    }
  });

  // Playback rate
  ipcMain.handle('vlc:setRate', async (_, rate) => {
    try {
      const manager = await getVlcManager();
      await manager.call(protocol.TO_CHILD.SET_RATE, rate);
    } catch (error) {
      console.error('[VLC] SetRate error:', error);
    }
  });

  ipcMain.handle('vlc:getRate', async () => {
    try {
      const manager = await getVlcManager();
      return await manager.call(protocol.TO_CHILD.GET_RATE);
    } catch (error) {
      return 1.0;
    }
  });

  // Legacy handlers for backward compatibility (window mode only)
  ipcMain.handle('vlc:destroyChildWindow', async () => {
    // Child window cleanup handled automatically by child process
    return { success: true };
  });

  ipcMain.handle('vlc:showWindow', async () => {
    // Not needed in new architecture
    return true;
  });

  ipcMain.handle('vlc:hideWindow', async () => {
    // Not needed in new architecture
    return true;
  });

  // Frame retrieval (legacy, not used with MessagePort)
  ipcMain.handle('vlc:getFrame', async () => {
    console.warn('[VLC] getFrame is deprecated, use MessagePort frame transfer');
    return null;
  });

  ipcMain.handle('vlc:getVideoFormat', async () => {
    console.warn('[VLC] getVideoFormat is deprecated');
    return null;
  });

  console.log('[VLC] IPC handlers registered successfully');
}

/**
 * Cleanup VLC resources
 */
async function cleanupVlc() {
  if (vlcManager) {
    console.log('[VLC] Cleaning up VLC process...');
    try {
      await vlcManager.stop();
    } catch (error) {
      console.error('[VLC] Cleanup error:', error);
    }
    vlcManager = null;
  }
}

module.exports = {
  registerVlcHandlers,
  cleanupVlc,
};
