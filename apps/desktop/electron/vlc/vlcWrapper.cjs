/**
 * VLC Child Process Wrapper
 *
 * Entry point for the VLC child process. Loads the native VLC addon,
 * handles IPC messages from parent, and forwards events back.
 *
 * Runs in a pure Node.js environment (no Electron/Chromium),
 * which solves X11/GPU deadlock issues.
 */

const path = require('path');
const fs = require('fs');
const protocol = require('./messageProtocol.cjs');

// Global state
let vlcModule = null;
let player = null;
let framePort = null;
let lastTimeUpdate = 0;
const THROTTLE_MS = 250;

// Frame buffer pool (3 rotating buffers to avoid constant allocation)
const BUFFER_POOL_SIZE = 3;
let bufferPool = [];
let currentBufferIndex = 0;

/**
 * Find VLC module path
 * Searches common locations for the native addon
 */
function findVlcModulePath() {
  const possiblePaths = [
    // Development: relative to electron/vlc/
    path.join(__dirname, '../../../core/vlc-player'),
    // Development: from out/main/vlc/ -> workspace root
    path.join(__dirname, '../../../../core/vlc-player'),
    // Development: from workspace root
    path.join(process.cwd(), 'core/vlc-player'),
    // Development: absolute path from apps/desktop
    path.join(process.cwd(), '../../core/vlc-player'),
    // Production: resources directory
    process.resourcesPath ? path.join(process.resourcesPath, 'vlc-player') : null,
  ].filter(Boolean);

  console.log('[VLC Module Search] Searching in paths:', possiblePaths);

  for (const modulePath of possiblePaths) {
    console.log('[VLC Module Search] Checking:', modulePath);
    if (fs.existsSync(modulePath)) {
      console.log('[VLC Module Search] ✅ Found at:', modulePath);
      return modulePath;
    }
  }

  console.error('[VLC Module Search] ❌ Not found in any path');
  return null;
}

/**
 * Load VLC native module
 */
function loadVlcModule() {
  if (vlcModule) return vlcModule;

  const modulePath = findVlcModulePath();
  if (!modulePath) {
    throw new Error('VLC module not found');
  }

  try {
    vlcModule = require(modulePath);
    sendLog('info', 'VLC module loaded from: ' + modulePath);
    return vlcModule;
  } catch (error) {
    sendLog('error', 'Failed to load VLC module: ' + error.message);
    throw error;
  }
}

/**
 * Initialize VLC player instance
 */
function initializePlayer() {
  if (player) return player;

  const vlc = loadVlcModule();

  if (!vlc.isAvailable()) {
    throw new Error('VLC is not available on this system');
  }

  // Create player in memory mode (for canvas rendering)
  // Note: Window mode will be handled via createChildWindow
  player = vlc.createPlayer('mem');

  // Setup event listeners
  setupEventListeners();

  sendLog('info', 'VLC player initialized successfully');
  return player;
}

/**
 * Setup event listeners on VLC player
 */
function setupEventListeners() {
  if (!player) return;

  // Time changed (throttled to 250ms)
  player.on('timeChanged', (time) => {
    const now = Date.now();
    if (now - lastTimeUpdate >= THROTTLE_MS) {
      sendEvent(protocol.EVENTS.TIME_CHANGED, time);
      lastTimeUpdate = now;
    }
  });

  // State changed
  player.on('stateChanged', (state) => {
    sendEvent(protocol.EVENTS.STATE_CHANGED, state);
  });

  // Duration changed
  player.on('durationChanged', (duration) => {
    sendEvent(protocol.EVENTS.DURATION_CHANGED, duration);
  });

  // Position changed (throttled)
  let lastPositionUpdate = 0;
  player.on('positionChanged', (position) => {
    const now = Date.now();
    if (now - lastPositionUpdate >= THROTTLE_MS) {
      sendEvent(protocol.EVENTS.POSITION_CHANGED, position);
      lastPositionUpdate = now;
    }
  });

  // End reached
  player.on('endReached', () => {
    sendEvent(protocol.EVENTS.END_REACHED, null);
  });

  // Error
  player.on('error', (message) => {
    sendEvent(protocol.EVENTS.ERROR, message);
  });

  // Audio volume
  player.on('audioVolume', (volume) => {
    sendEvent(protocol.EVENTS.AUDIO_VOLUME, volume);
  });
}

/**
 * Initialize frame buffer pool for video rendering
 */
function initializeBufferPool(width, height) {
  const bufferSize = width * height * 4; // RGBA
  bufferPool = [];
  for (let i = 0; i < BUFFER_POOL_SIZE; i++) {
    bufferPool.push(new ArrayBuffer(bufferSize));
  }
  currentBufferIndex = 0;
  sendLog('info', `Buffer pool initialized: ${BUFFER_POOL_SIZE} buffers of ${bufferSize} bytes`);
}

/**
 * Get next buffer from pool (rotating)
 */
function getNextBuffer() {
  currentBufferIndex = (currentBufferIndex + 1) % BUFFER_POOL_SIZE;
  return bufferPool[currentBufferIndex];
}

/**
 * Setup video callback for canvas rendering
 * Called when renderer is ready to receive frames via MessagePort
 */
function setupVideoCallback(width, height) {
  if (!player) {
    throw new Error('Player not initialized');
  }

  if (!framePort) {
    throw new Error('Frame port not set up');
  }

  // Initialize buffer pool with video dimensions
  initializeBufferPool(width, height);

  // Setup video callback on native player
  player.setVideoCallback((pixels, videoWidth, videoHeight) => {
    try {
      // Get next buffer from pool
      const buffer = getNextBuffer();
      const view = new Uint8ClampedArray(buffer);

      // Copy pixel data to buffer
      view.set(pixels);

      // Send buffer to renderer via MessagePort (transferable)
      framePort.postMessage({
        type: protocol.EVENTS.VIDEO_FRAME,
        frameBuffer: buffer,
        width: videoWidth,
        height: videoHeight,
        timestamp: Date.now()
      }, [buffer]); // Transfer ownership

    } catch (error) {
      sendLog('error', 'Video callback error: ' + error.message);
    }
  });

  sendLog('info', `Video callback setup complete: ${width}x${height}`);
}

/**
 * Handle incoming IPC messages from parent process
 */
function handleMessage(message) {
  const { type, method, args = [], id } = message;

  if (type !== 'method') {
    sendLog('warn', 'Unknown message type: ' + type);
    return;
  }

  try {
    // Route method calls to appropriate handlers
    let result;

    switch (method) {
      // Initialization
      case protocol.TO_CHILD.INIT:
        initializePlayer();
        result = { success: true };
        break;

      // Playback control
      case protocol.TO_CHILD.PLAY:
        result = player.play(...args);
        break;

      case protocol.TO_CHILD.PAUSE:
        player.pause();
        result = undefined;
        break;

      case protocol.TO_CHILD.STOP:
        player.stop();
        result = undefined;
        break;

      case protocol.TO_CHILD.SEEK:
        player.seek(...args);
        result = undefined;
        break;

      // Volume
      case protocol.TO_CHILD.SET_VOLUME:
        player.setVolume(...args);
        result = undefined;
        break;

      case protocol.TO_CHILD.GET_VOLUME:
        result = player.getVolume();
        break;

      // Rate
      case protocol.TO_CHILD.SET_RATE:
        player.setRate(...args);
        result = undefined;
        break;

      case protocol.TO_CHILD.GET_RATE:
        result = player.getRate();
        break;

      // Audio tracks
      case protocol.TO_CHILD.SET_AUDIO_TRACK:
        result = player.setAudioTrack(...args);
        break;

      case protocol.TO_CHILD.GET_AUDIO_TRACKS:
        result = player.getAudioTracks();
        break;

      // Subtitle tracks
      case protocol.TO_CHILD.SET_SUBTITLE_TRACK:
        result = player.setSubtitleTrack(...args);
        break;

      case protocol.TO_CHILD.GET_SUBTITLE_TRACKS:
        result = player.getSubtitleTracks();
        break;

      case protocol.TO_CHILD.SET_SUBTITLE_DELAY:
        result = player.setSubtitleDelay(...args);
        break;

      // State queries
      case protocol.TO_CHILD.GET_STATE:
        result = player.getState();
        break;

      case protocol.TO_CHILD.IS_PLAYING:
        result = player.isPlaying();
        break;

      case protocol.TO_CHILD.IS_SEEKABLE:
        result = player.isSeekable();
        break;

      case protocol.TO_CHILD.GET_TIME:
        result = player.getTime();
        break;

      case protocol.TO_CHILD.GET_DURATION:
        result = player.getLength();
        break;

      // Window mode (child window creation)
      case protocol.TO_CHILD.CREATE_WINDOW:
        result = player.createChildWindow(...args);
        break;

      case protocol.TO_CHILD.RESIZE_WINDOW:
        result = player.setBounds(...args);
        break;

      // Video callback setup (canvas rendering)
      case protocol.TO_CHILD.SET_VIDEO_CALLBACK:
        setupVideoCallback(...args);
        result = { success: true };
        break;

      default:
        throw new Error('Unknown method: ' + method);
    }

    // Send result back to parent
    sendResult(id, result);

  } catch (error) {
    sendError(id, error);
  }
}

/**
 * Send result message to parent process
 */
function sendResult(id, result) {
  if (process.send) {
    process.send(protocol.createResult(id, result));
  }
}

/**
 * Send error message to parent process
 */
function sendError(id, error) {
  if (process.send) {
    process.send(protocol.createError(id, error));
  }
}

/**
 * Send event to parent process
 */
function sendEvent(event, data) {
  if (process.send) {
    process.send(protocol.createEvent(event, data));
  }
}

/**
 * Send log message to parent process
 */
function sendLog(level, message, data = null) {
  if (process.send) {
    process.send(protocol.createLog(level, message, data));
  }
}

/**
 * Handle MessagePort for frame transfer
 */
function handlePortMessage(port) {
  framePort = port;

  // Setup message listener if needed (for control messages from renderer)
  if (framePort.on) {
    framePort.on('message', (msg) => {
      sendLog('debug', 'Received message from frame port', msg);
    });
  }

  sendLog('info', 'Frame MessagePort established');
}

/**
 * Main process entry point
 */
function main() {
  sendLog('info', 'VLC child process starting...');
  sendLog('info', 'Process ID: ' + process.pid);
  sendLog('info', 'Node version: ' + process.version);
  sendLog('info', 'Platform: ' + process.platform);

  // Listen for messages from parent process
  process.on('message', (message) => {
    // Check if this is a frame-port setup message with transferable port
    if (message && message.type === 'frame-port' && message.port) {
      handlePortMessage(message.port);
    } else if (message && message.type === 'method') {
      // Regular method call
      handleMessage(message);
    } else {
      sendLog('warn', 'Unknown message received', message);
    }
  });

  // Handle process termination
  process.on('SIGTERM', () => {
    sendLog('info', 'Received SIGTERM, cleaning up...');
    if (player) {
      try {
        player.stop();
        player.dispose();
      } catch (error) {
        sendLog('error', 'Cleanup error: ' + error.message);
      }
    }
    process.exit(0);
  });

  process.on('SIGINT', () => {
    sendLog('info', 'Received SIGINT, cleaning up...');
    if (player) {
      try {
        player.stop();
        player.dispose();
      } catch (error) {
        sendLog('error', 'Cleanup error: ' + error.message);
      }
    }
    process.exit(0);
  });

  // Send ready signal to parent
  if (process.send) {
    const readyMsg = protocol.createReady();
    console.log('[VLC Wrapper] Sending ready signal:', readyMsg);
    process.send(readyMsg);
    console.log('[VLC Wrapper] Ready signal sent successfully');
  } else {
    console.error('[VLC Wrapper] process.send is not available!');
  }

  sendLog('info', 'VLC child process ready and waiting for commands');
}

// Start the process
main();
