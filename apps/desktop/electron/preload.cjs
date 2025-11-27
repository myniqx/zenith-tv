const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  version: process.versions.electron,

  // P2P Remote Control
  p2p: {
    start: (port) => ipcRenderer.invoke('p2p:start', port),
    stop: () => ipcRenderer.invoke('p2p:stop'),
    acceptPairing: (deviceId, pin) => ipcRenderer.invoke('p2p:acceptPairing', deviceId, pin),
    rejectPairing: (deviceId) => ipcRenderer.invoke('p2p:rejectPairing', deviceId),
    broadcastState: (state) => ipcRenderer.invoke('p2p:broadcastState', state),
    getDeviceInfo: () => ipcRenderer.invoke('p2p:getDeviceInfo'),

    // Event listeners
    onPairingRequest: (callback) => ipcRenderer.on('p2p:pairing-request', (_, data) => callback(data)),
    onPlay: (callback) => ipcRenderer.on('p2p:play', (_, data) => callback(data)),
    onPause: (callback) => ipcRenderer.on('p2p:pause', () => callback()),
    onSeek: (callback) => ipcRenderer.on('p2p:seek', (_, position) => callback(position)),
    onSetVolume: (callback) => ipcRenderer.on('p2p:set-volume', (_, volume) => callback(volume)),
  },

  // File System API
  fs: {
    readFile: (path, options) => ipcRenderer.invoke('fs:readFile', path, options),
    writeFile: (path, content, options) => ipcRenderer.invoke('fs:writeFile', path, content, options),
    readDir: (path, options) => ipcRenderer.invoke('fs:readDir', path, options),
    mkdir: (path, recursive) => ipcRenderer.invoke('fs:mkdir', path, recursive),
    delete: (path) => ipcRenderer.invoke('fs:delete', path),
    move: (oldPath, newPath) => ipcRenderer.invoke('fs:move', oldPath, newPath),
    copyFile: (sourcePath, destPath) => ipcRenderer.invoke('fs:copyFile', sourcePath, destPath),
    exists: (path) => ipcRenderer.invoke('fs:exists', path),
    stats: (path) => ipcRenderer.invoke('fs:stats', path),
    watch: (path, callback) => {
      const listener = (_, data) => callback(data.event, data.filename);
      ipcRenderer.on('fs:watch:change', listener);
      return ipcRenderer.invoke('fs:watch', path);
    },
    unwatch: (watcherId) => ipcRenderer.invoke('fs:unwatch', watcherId),
  },

  // Fetch API
  fetch: {
    request: (url, options) => ipcRenderer.invoke('fetch:request', url, options),
    stream: (url, options) => ipcRenderer.invoke('fetch:stream', url, options),
    m3u: (url, onProgress) => ipcRenderer.invoke('fetch:m3u', url, onProgress),
  },

  // HTTP API (alias for fetch)
  http: {
    request: (url, options) => ipcRenderer.invoke('fetch:request', url, options),
    stream: (url, options) => ipcRenderer.invoke('fetch:stream', url, options),
  },

  // Dialog API
  dialog: {
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
    openDirectory: (options) => ipcRenderer.invoke('dialog:openDirectory', options),
    saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  },

  // App API
  app: {
    getPath: (name) => ipcRenderer.invoke('app:getPath', name),
  },

  // VLC Player API
  vlc: {
    isAvailable: () => ipcRenderer.invoke('vlc:isAvailable'),
    init: () => ipcRenderer.invoke('vlc:init'),

    // Unified API
    open: (options) => ipcRenderer.invoke('vlc:open', options),
    playback: (options) => ipcRenderer.invoke('vlc:playback', options),
    audio: (options) => ipcRenderer.invoke('vlc:audio', options),
    video: (options) => ipcRenderer.invoke('vlc:video', options),
    subtitle: (options) => ipcRenderer.invoke('vlc:subtitle', options),
    window: (options) => ipcRenderer.invoke('vlc:window', options),
    shortcut: (options) => ipcRenderer.invoke('vlc:shortcut', options),
    getMediaInfo: () => ipcRenderer.invoke('vlc:getMediaInfo'),
    getPlayerInfo: () => ipcRenderer.invoke('vlc:getPlayerInfo'),

    // Event listeners
    onTimeChanged: (callback) => ipcRenderer.on('vlc:timeChanged', (_, time) => callback(time)),
    onStateChanged: (callback) => ipcRenderer.on('vlc:stateChanged', (_, state) => callback(state)),
    onEndReached: (callback) => ipcRenderer.on('vlc:endReached', () => callback()),
    onError: (callback) => ipcRenderer.on('vlc:error', (_, message) => callback(message)),
    onShortcut: (callback) => ipcRenderer.on('vlc:shortcut', (_, action) => callback(action)),
  },

  // Window API
  window: {
    onPositionChanged: (callback) => ipcRenderer.on('window:positionChanged', (_, data) => callback(data)),
  },
});
