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
  },

  // M3U Management API
  m3u: {
    addToProfile: (username, m3uUrl) => ipcRenderer.invoke('m3u:addToProfile', username, m3uUrl),
    removeFromProfile: (username, uuid) => ipcRenderer.invoke('m3u:removeFromProfile', username, uuid),
    getProfileM3Us: (username) => ipcRenderer.invoke('m3u:getProfileM3Us', username),
    fetchAndCache: (uuid, m3uUrl) => ipcRenderer.invoke('m3u:fetchAndCache', uuid, m3uUrl),
    update: (uuid, m3uUrl, parseFunction) => ipcRenderer.invoke('m3u:update', uuid, m3uUrl, parseFunction),
    loadSource: (uuid) => ipcRenderer.invoke('m3u:loadSource', uuid),
    getRecentItems: (username, daysToKeep) => ipcRenderer.invoke('m3u:getRecentItems', username, daysToKeep),
    getOutdated: (username, maxAgeHours) => ipcRenderer.invoke('m3u:getOutdated', username, maxAgeHours),
    getStats: (username) => ipcRenderer.invoke('m3u:getStats', username),

    // Event listeners for progress
    onFetchProgress: (callback) => ipcRenderer.on('m3u:fetch-progress', (_, data) => callback(data)),
    onUpdateProgress: (callback) => ipcRenderer.on('m3u:update-progress', (_, data) => callback(data)),
  },

  // User Data API (per-user, per-M3U)
  userData: {
    get: (username, uuid) => ipcRenderer.invoke('userData:get', username, uuid),
    getItem: (username, uuid, itemUrl) => ipcRenderer.invoke('userData:getItem', username, uuid, itemUrl),
    updateItem: (username, uuid, itemUrl, updates) => ipcRenderer.invoke('userData:updateItem', username, uuid, itemUrl, updates),
    deleteItem: (username, uuid, itemUrl) => ipcRenderer.invoke('userData:deleteItem', username, uuid, itemUrl),

    toggleFavorite: (username, uuid, itemUrl) => ipcRenderer.invoke('userData:toggleFavorite', username, uuid, itemUrl),
    toggleHidden: (username, uuid, itemUrl) => ipcRenderer.invoke('userData:toggleHidden', username, uuid, itemUrl),
    updateWatchProgress: (username, uuid, itemUrl, progress) => ipcRenderer.invoke('userData:updateWatchProgress', username, uuid, itemUrl, progress),
    markAsWatched: (username, uuid, itemUrl) => ipcRenderer.invoke('userData:markAsWatched', username, uuid, itemUrl),
    saveTracks: (username, uuid, itemUrl, audioTrack, subtitleTrack) => ipcRenderer.invoke('userData:saveTracks', username, uuid, itemUrl, audioTrack, subtitleTrack),

    getAllFavorites: (username, uuids) => ipcRenderer.invoke('userData:getAllFavorites', username, uuids),
    getAllRecentlyWatched: (username, uuids, limit) => ipcRenderer.invoke('userData:getAllRecentlyWatched', username, uuids, limit),
    getStats: (username, uuid) => ipcRenderer.invoke('userData:getStats', username, uuid),
    getCombinedStats: (username, uuids) => ipcRenderer.invoke('userData:getCombinedStats', username, uuids),

    clearOldHistory: (username, uuid, daysToKeep) => ipcRenderer.invoke('userData:clearOldHistory', username, uuid, daysToKeep),
    deleteAll: (username, uuid) => ipcRenderer.invoke('userData:deleteAll', username, uuid),
    deleteAllForUser: (username) => ipcRenderer.invoke('userData:deleteAllForUser', username),
    clearCache: (username, uuid) => ipcRenderer.invoke('userData:clearCache', username, uuid),
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
