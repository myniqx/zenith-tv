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

  // VLC Player API (Child Process Architecture)
  vlc: {
    isAvailable: () => ipcRenderer.invoke('vlc:isAvailable'),

    // Initialize VLC player and get MessagePort for frame transfer
    // Returns: { success: boolean, framePort?: MessagePort, error?: string }
    init: () => ipcRenderer.invoke('vlc:init'),

    // Window mode: Create child window for VLC rendering
    createChildWindow: (x, y, width, height) => ipcRenderer.invoke('vlc:createChildWindow', x, y, width, height),
    destroyChildWindow: () => ipcRenderer.invoke('vlc:destroyChildWindow'),
    setBounds: (x, y, width, height) => ipcRenderer.invoke('vlc:setBounds', x, y, width, height),
    showWindow: () => ipcRenderer.invoke('vlc:showWindow'),
    hideWindow: () => ipcRenderer.invoke('vlc:hideWindow'),

    // Canvas mode: Setup video callback for frame rendering via MessagePort
    setupVideoCallback: (width, height) => ipcRenderer.invoke('vlc:setupVideoCallback', width, height),

    // Playback control
    play: (url) => ipcRenderer.invoke('vlc:play', url),
    pause: () => ipcRenderer.invoke('vlc:pause'),
    resume: () => ipcRenderer.invoke('vlc:resume'),
    stop: () => ipcRenderer.invoke('vlc:stop'),
    seek: (time) => ipcRenderer.invoke('vlc:seek', time),

    // Volume
    setVolume: (volume) => ipcRenderer.invoke('vlc:setVolume', volume),
    getVolume: () => ipcRenderer.invoke('vlc:getVolume'),
    setMute: (mute) => ipcRenderer.invoke('vlc:setMute', mute),
    getMute: () => ipcRenderer.invoke('vlc:getMute'),

    // Time/Position
    getTime: () => ipcRenderer.invoke('vlc:getTime'),
    getLength: () => ipcRenderer.invoke('vlc:getLength'),
    getPosition: () => ipcRenderer.invoke('vlc:getPosition'),
    setPosition: (position) => ipcRenderer.invoke('vlc:setPosition', position),

    // State
    getState: () => ipcRenderer.invoke('vlc:getState'),
    isPlaying: () => ipcRenderer.invoke('vlc:isPlaying'),
    isSeekable: () => ipcRenderer.invoke('vlc:isSeekable'),

    // Audio tracks
    getAudioTracks: () => ipcRenderer.invoke('vlc:getAudioTracks'),
    getAudioTrack: () => ipcRenderer.invoke('vlc:getAudioTrack'),
    setAudioTrack: (trackId) => ipcRenderer.invoke('vlc:setAudioTrack', trackId),

    // Subtitle tracks
    getSubtitleTracks: () => ipcRenderer.invoke('vlc:getSubtitleTracks'),
    getSubtitleTrack: () => ipcRenderer.invoke('vlc:getSubtitleTrack'),
    setSubtitleTrack: (trackId) => ipcRenderer.invoke('vlc:setSubtitleTrack', trackId),
    setSubtitleDelay: (delay) => ipcRenderer.invoke('vlc:setSubtitleDelay', delay),

    // Video tracks
    getVideoTracks: () => ipcRenderer.invoke('vlc:getVideoTracks'),

    // Playback rate
    setRate: (rate) => ipcRenderer.invoke('vlc:setRate', rate),
    getRate: () => ipcRenderer.invoke('vlc:getRate'),

    // Event listeners
    onTimeChanged: (callback) => ipcRenderer.on('vlc:timeChanged', (_, time) => callback(time)),
    onStateChanged: (callback) => ipcRenderer.on('vlc:stateChanged', (_, state) => callback(state)),
    onEndReached: (callback) => ipcRenderer.on('vlc:endReached', () => callback()),
    onError: (callback) => ipcRenderer.on('vlc:error', (_, message) => callback(message)),
  },
});
