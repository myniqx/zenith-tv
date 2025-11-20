const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { getStorageAPI, getProfileManager, getUserDataManager, getM3UManager } = require('./storage/index.cjs');
const { P2PServer } = require('./p2p-server.cjs');

let mainWindow;
let storage;
let profileManager;
let userDataManager;
let m3uManager;
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

app.whenReady().then(async () => {
  // Initialize storage
  storage = getStorageAPI();
  await storage.init();

  profileManager = getProfileManager();
  userDataManager = getUserDataManager();
  m3uManager = getM3UManager();

  // Initialize P2P server (will update later if needed)
  p2pServer = new P2PServer();

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
    storage?.close();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  p2pServer?.stop();
  await storage?.close();
});

// IPC Handlers
function setupIPCHandlers() {
  // Profiles
  ipcMain.handle('profile:getAll', async () => {
    return await profileManager.getAllProfiles();
  });

  ipcMain.handle('profile:get', async (_, username) => {
    return await profileManager.getProfile(username);
  });

  ipcMain.handle('profile:create', async (_, username) => {
    return await profileManager.createProfile(username);
  });

  ipcMain.handle('profile:delete', async (_, username) => {
    await profileManager.deleteProfile(username);
  });

  ipcMain.handle('profile:hasProfile', async (_, username) => {
    return await profileManager.hasProfile(username);
  });

  // M3U Management
  ipcMain.handle('m3u:addToProfile', async (_, username, m3uUrl) => {
    return await profileManager.addM3UToProfile(username, m3uUrl);
  });

  ipcMain.handle('m3u:removeFromProfile', async (_, username, uuid) => {
    await profileManager.removeM3UFromProfile(username, uuid);
  });

  ipcMain.handle('m3u:getProfileM3Us', async (_, username) => {
    return await profileManager.getProfileM3Us(username);
  });

  ipcMain.handle('m3u:fetchAndCache', async (_, uuid, m3uUrl) => {
    return await profileManager.fetchAndCacheM3U(uuid, m3uUrl, (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('m3u:fetch-progress', { uuid, progress });
      }
    });
  });

  ipcMain.handle('m3u:update', async (_, uuid, m3uUrl, parseFunction) => {
    return await profileManager.updateM3U(uuid, m3uUrl, parseFunction, (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('m3u:update-progress', { uuid, progress });
      }
    });
  });

  ipcMain.handle('m3u:loadSource', async (_, uuid) => {
    return await profileManager.loadM3USource(uuid);
  });

  ipcMain.handle('m3u:getRecentItems', async (_, username, daysToKeep) => {
    return await profileManager.getRecentItems(username, daysToKeep || 30);
  });

  ipcMain.handle('m3u:getOutdated', async (_, username, maxAgeHours) => {
    return await profileManager.getOutdatedM3Us(username, maxAgeHours || 24);
  });

  ipcMain.handle('m3u:getStats', async (_, username) => {
    return await profileManager.getProfileStats(username);
  });

  ipcMain.handle('m3u:saveStats', async (_, uuid, parsedItems) => {
    return await profileManager.saveM3UStats(uuid, parsedItems);
  });

  // New M3U Manager API
  ipcMain.handle('m3u:createUUID', async (_, m3uUrl) => {
    return await m3uManager.createUUID(m3uUrl);
  });

  ipcMain.handle('m3u:deleteUUID', async (_, uuid) => {
    await m3uManager.deleteUUID(uuid);
  });

  ipcMain.handle('m3u:getURLForUUID', async (_, uuid) => {
    return await m3uManager.getURLForUUID(uuid);
  });

  ipcMain.handle('m3u:getAllUUIDs', async () => {
    return await m3uManager.getAllUUIDs();
  });

  ipcMain.handle('m3u:hasSource', async (_, uuid) => {
    return await m3uManager.hasSource(uuid);
  });

  ipcMain.handle('m3u:writeUUID', async (_, uuid, data) => {
    await m3uManager.writeUUID(uuid, data);
  });

  ipcMain.handle('m3u:readUUID', async (_, uuid) => {
    return await m3uManager.readUUID(uuid);
  });

  ipcMain.handle('m3u:fetchUUID', async (_, urlOrPath) => {
    return await m3uManager.fetchUUID(urlOrPath, (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('m3u:fetch-progress', { progress });
      }
    });
  });

  // User Data (per-user, per-M3U)
  ipcMain.handle('userData:readData', async (_, username, uuid) => {
    return await userDataManager.loadUserData(username, uuid);
  });

  ipcMain.handle('userData:writeData', async (_, username, uuid, data) => {
    await userDataManager.saveUserData(username, uuid, data);
  });

  ipcMain.handle('userData:deleteData', async (_, username, uuid) => {
    await userDataManager.deleteUserData(username, uuid);
  });

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
