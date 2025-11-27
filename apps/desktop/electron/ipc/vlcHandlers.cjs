/**
 * VLC Player IPC Handlers
 *
 * Handles communication between renderer process and VLC standalone process.
 * Uses VlcProcessManager to communicate with isolated Node.js process.
 */

const { ipcMain } = require('electron');
const { VlcProcessManager } = require('../vlc/vlcProcessManager.cjs');

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
      await manager.call('init');
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

      // Initialize player in standalone process
      await manager.call('init');

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

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Unified Window API
  ipcMain.handle('vlc:window', async (_, options) => {
    try {
      const manager = await getVlcManager();
      return await manager.call('window', options);
    } catch (error) {
      console.error('[VLC] Window error:', error);
      return false;
    }
  });

  // Unified API
  ipcMain.handle('vlc:open', async (_, options) => {
    try {
      const manager = await getVlcManager();
      return await manager.call('open', options);
    } catch (error) {
      console.error('[VLC] Open error:', error);
      return false;
    }
  });

  ipcMain.handle('vlc:playback', async (_, options) => {
    try {
      const manager = await getVlcManager();
      return await manager.call('playback', options);
    } catch (error) {
      console.error('[VLC] Playback error:', error);
    }
  });

  ipcMain.handle('vlc:audio', async (_, options) => {
    try {
      const manager = await getVlcManager();
      return await manager.call('audio', options);
    } catch (error) {
      console.error('[VLC] Audio error:', error);
    }
  });

  ipcMain.handle('vlc:video', async (_, options) => {
    try {
      const manager = await getVlcManager();
      return await manager.call('video', options);
    } catch (error) {
      console.error('[VLC] Video error:', error);
    }
  });

  ipcMain.handle('vlc:subtitle', async (_, options) => {
    try {
      const manager = await getVlcManager();
      return await manager.call('subtitle', options);
    } catch (error) {
      console.error('[VLC] Subtitle error:', error);
    }
  });

  ipcMain.handle('vlc:getMediaInfo', async () => {
    try {
      const manager = await getVlcManager();
      return await manager.call('getMediaInfo');
    } catch (error) {
      console.error('[VLC] GetMediaInfo error:', error);
      return null;
    }
  });

  ipcMain.handle('vlc:getPlayerInfo', async () => {
    try {
      const manager = await getVlcManager();
      return await manager.call('getPlayerInfo');
    } catch (error) {
      console.error('[VLC] GetPlayerInfo error:', error);
      return null;
    }
  });

  console.log('[VLC] IPC handlers registered');
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
