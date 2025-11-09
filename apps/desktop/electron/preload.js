const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  version: process.versions.electron,

  // Database API
  db: {
    // Profiles
    getProfiles: () => ipcRenderer.invoke('db:getProfiles'),
    addProfile: (name, url) => ipcRenderer.invoke('db:addProfile', name, url),
    deleteProfile: (id) => ipcRenderer.invoke('db:deleteProfile', id),

    // Items
    getItemsByProfile: (profileId) => ipcRenderer.invoke('db:getItemsByProfile', profileId),
    upsertItems: (profileId, items) => ipcRenderer.invoke('db:upsertItems', profileId, items),
    updateProfileSync: (profileId, count) => ipcRenderer.invoke('db:updateProfileSync', profileId, count),

    // Recent
    getRecentItems: (profileId) => ipcRenderer.invoke('db:getRecentItems', profileId),
    addToRecent: (itemUrls) => ipcRenderer.invoke('db:addToRecent', itemUrls),

    // Favorites
    toggleFavorite: (itemUrl) => ipcRenderer.invoke('db:toggleFavorite', itemUrl),
    getFavorites: (profileId) => ipcRenderer.invoke('db:getFavorites', profileId),

    // Watch History
    saveWatchProgress: (itemUrl, position, duration) =>
      ipcRenderer.invoke('db:saveWatchProgress', itemUrl, position, duration),
    getWatchHistory: (itemUrl) => ipcRenderer.invoke('db:getWatchHistory', itemUrl),

    // M3U Cache
    getM3UCache: (url) => ipcRenderer.invoke('db:getM3UCache', url),
    saveM3UCache: (url, content, etag, lastModified, expiresInHours) =>
      ipcRenderer.invoke('db:saveM3UCache', url, content, etag, lastModified, expiresInHours),
    invalidateM3UCache: (url) => ipcRenderer.invoke('db:invalidateM3UCache', url),
    cleanExpiredCache: () => ipcRenderer.invoke('db:cleanExpiredCache'),
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
});
