const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { getDatabase } = require('./database.cjs');
const { P2PServer } = require('./p2p-server.cjs');

let mainWindow;
let db;
let p2pServer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode
    mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database
  db = getDatabase();
  db.init();

  // Initialize P2P server
  p2pServer = new P2PServer(db);

  // Setup event handlers for P2P
  p2pServer.onPairingRequest = (pairing) => {
    if (mainWindow) {
      mainWindow.webContents.send('p2p:pairing-request', pairing);
    }
  };

  p2pServer.onPlayCommand = (item, position) => {
    if (mainWindow) {
      mainWindow.webContents.send('p2p:play', { item, position });
    }
  };

  p2pServer.onPauseCommand = () => {
    if (mainWindow) {
      mainWindow.webContents.send('p2p:pause');
    }
  };

  p2pServer.onSeekCommand = (position) => {
    if (mainWindow) {
      mainWindow.webContents.send('p2p:seek', position);
    }
  };

  p2pServer.onSetVolumeCommand = (volume) => {
    if (mainWindow) {
      mainWindow.webContents.send('p2p:set-volume', volume);
    }
  };

  // Setup IPC handlers
  setupIPCHandlers();

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    p2pServer?.stop();
    db?.close();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  p2pServer?.stop();
  db?.close();
});

// IPC Handlers
function setupIPCHandlers() {
  // Profiles
  ipcMain.handle('db:getProfiles', () => db.getProfiles());
  ipcMain.handle('db:addProfile', (_, name, url) => db.addProfile(name, url));
  ipcMain.handle('db:deleteProfile', (_, id) => db.deleteProfile(id));

  // Items
  ipcMain.handle('db:getItemsByProfile', (_, profileId) => db.getItemsByProfile(profileId));
  ipcMain.handle('db:upsertItems', (_, profileId, items) => db.upsertItems(profileId, items));
  ipcMain.handle('db:updateProfileSync', (_, profileId, count) => db.updateProfileSync(profileId, count));

  // Recent
  ipcMain.handle('db:getRecentItems', (_, profileId) => db.getRecentItems(profileId));
  ipcMain.handle('db:addToRecent', (_, itemUrls) => db.addToRecent(itemUrls));

  // Favorites
  ipcMain.handle('db:toggleFavorite', (_, itemUrl) => db.toggleFavorite(itemUrl));
  ipcMain.handle('db:getFavorites', (_, profileId) => db.getFavorites(profileId));

  // Watch History
  ipcMain.handle('db:saveWatchProgress', (_, itemUrl, position, duration) =>
    db.saveWatchProgress(itemUrl, position, duration)
  );
  ipcMain.handle('db:getWatchHistory', (_, itemUrl) => db.getWatchHistory(itemUrl));

  // M3U Cache
  ipcMain.handle('db:getM3UCache', (_, url) => db.getM3UCache(url));
  ipcMain.handle('db:saveM3UCache', (_, url, content, etag, lastModified, expiresInHours) =>
    db.saveM3UCache(url, content, etag, lastModified, expiresInHours)
  );
  ipcMain.handle('db:invalidateM3UCache', (_, url) => db.invalidateM3UCache(url));
  ipcMain.handle('db:cleanExpiredCache', () => db.cleanExpiredCache());

  // P2P Remote Control
  ipcMain.handle('p2p:start', (_, port) => {
    p2pServer.start(port);
    return { deviceId: p2pServer.deviceId, port: p2pServer.port };
  });

  ipcMain.handle('p2p:stop', () => {
    p2pServer.stop();
  });

  ipcMain.handle('p2p:acceptPairing', (_, deviceId, pin) => {
    return p2pServer.acceptPairing(deviceId, pin);
  });

  ipcMain.handle('p2p:rejectPairing', (_, deviceId) => {
    p2pServer.rejectPairing(deviceId);
  });

  ipcMain.handle('p2p:broadcastState', (_, state) => {
    p2pServer.broadcastState(state);
  });

  ipcMain.handle('p2p:getDeviceInfo', () => {
    return {
      id: p2pServer.deviceId,
      name: p2pServer.deviceName,
      port: p2pServer.port,
    };
  });

  // File operations
  ipcMain.handle('file:selectM3U', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'M3U Playlists', extensions: ['m3u', 'm3u8'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        path: filePath,
        content: content,
        name: path.basename(filePath)
      };
    } catch (error) {
      console.error('Failed to read M3U file:', error);
      throw error;
    }
  });
}
