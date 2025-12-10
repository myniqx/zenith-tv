const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const is = require('electron-is');
const { registerFileSystemHandlers, cleanupFileWatchers } = require('./ipc/fileHandlers');
const { registerFetchHandlers } = require('./ipc/fetchHandlers');
const { registerDialogHandlers } = require('./ipc/dialogHandlers');
const { registerP2PHandlers, cleanupP2P } = require('./ipc/p2pHandlers');
const { registerVlcHandlers, cleanupVlc } = require('./ipc/vlcHandlers.cjs');
const { registerWindowHandlers } = require('./ipc/windowHandlers');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: false,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (is.dev) {
      mainWindow.webContents.openDevTools()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // Setup workspace root path
  const workspaceRoot = path.join(app.getPath('userData'), 'zenith-tv');

  // Create workspace directory if it doesn't exist
  try {
    await fs.mkdir(workspaceRoot, { recursive: true });
  } catch (error) {
    console.error('Failed to create workspace directory:', error);
  }

  // Create window first
  createWindow();

  // Register IPC handlers with workspace root
  registerFileSystemHandlers(workspaceRoot)
  registerFetchHandlers()
  registerDialogHandlers()
  registerP2PHandlers(mainWindow)
  registerVlcHandlers(mainWindow)
  registerWindowHandlers(mainWindow)
});

app.on('window-all-closed', async () => {
  cleanupFileWatchers()
  await cleanupP2P()
  await cleanupVlc()
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', async (event) => {
  // Prevent default quit to allow async cleanup
  event.preventDefault();

  await cleanupP2P()
  cleanupFileWatchers()
  await cleanupVlc()

  // Now quit for real
  app.exit(0);
});
