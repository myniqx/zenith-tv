const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  version: process.versions.electron,

  // Profile Management API
  profile: {
    getAll: () => ipcRenderer.invoke('profile:getAll'),
    get: (username) => ipcRenderer.invoke('profile:get', username),
    create: (username) => ipcRenderer.invoke('profile:create', username),
    delete: (username) => ipcRenderer.invoke('profile:delete', username),
    hasProfile: (username) => ipcRenderer.invoke('profile:hasProfile', username),
    updateM3U: (username, m3uUrl) => ipcRenderer.invoke('profile:updateM3U', username, m3uUrl),
    removeM3U: (username, uuid) => ipcRenderer.invoke('profile:removeM3U', username, uuid),
  },

  // M3U Management API
  m3u: {
    // Legacy API (used by ProfileManager)
    addToProfile: (username, m3uUrl) => ipcRenderer.invoke('m3u:addToProfile', username, m3uUrl),
    removeFromProfile: (username, uuid) => ipcRenderer.invoke('m3u:removeFromProfile', username, uuid),
    getProfileM3Us: (username) => ipcRenderer.invoke('m3u:getProfileM3Us', username),

    // New M3U Manager API
    createUUID: (m3uUrl) => ipcRenderer.invoke('m3u:createUUID', m3uUrl),
    deleteUUID: (uuid) => ipcRenderer.invoke('m3u:deleteUUID', uuid),
    getURLForUUID: (uuid) => ipcRenderer.invoke('m3u:getURLForUUID', uuid),
    getAllUUIDs: () => ipcRenderer.invoke('m3u:getAllUUIDs'),
    hasSource: (uuid) => ipcRenderer.invoke('m3u:hasSource', uuid),
    writeUUID: (uuid, data) => ipcRenderer.invoke('m3u:writeUUID', uuid, data),
    readUUID: (uuid) => ipcRenderer.invoke('m3u:readUUID', uuid),
    fetchUUID: (urlOrPath) => ipcRenderer.invoke('m3u:fetchUUID', urlOrPath),

    // Event listeners for progress
    onFetchProgress: (callback) => ipcRenderer.on('m3u:fetch-progress', (_, data) => callback(data)),
    onUpdateProgress: (callback) => ipcRenderer.on('m3u:update-progress', (_, data) => callback(data)),
  },

  // User Data API (per-user, per-M3U)
  userData: {
    readData: (username, uuid) => ipcRenderer.invoke('userData:readData', username, uuid),
    writeData: (username, uuid, data) => ipcRenderer.invoke('userData:writeData', username, uuid, data),
    deleteData: (username, uuid) => ipcRenderer.invoke('userData:deleteData', username, uuid),
  },

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

  // File operations
  file: {
    selectM3U: () => ipcRenderer.invoke('file:selectM3U'),
  },
});
