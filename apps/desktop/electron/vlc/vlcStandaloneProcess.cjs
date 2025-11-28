/**
 * VLC Standalone Process
 *
 * Runs in pure Node.js environment (isolated from Electron/Chromium).
 * Solves X11 display connection issues by running VLC in separate process.
 *
 * Communication: JSON Lines Protocol (newline-delimited JSON)
 * - STDIN: Receives commands from parent process
 * - STDOUT: Sends responses and events to parent process
 * - STDERR: Logs for debugging
 */

const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Global state
let vlcModule = null;
let player = null;
let windowCreated = false;
let lastTimeUpdate = 0;
const THROTTLE_MS = 250;

/**
 * Find VLC module path
 */
function findVlcModulePath() {
  const fs = require('fs');

  const possiblePaths = [
    // From apps/desktop/electron/vlc -> ../../.. -> workspace root -> core/vlc-player
    path.join(__dirname, '../../../../core/vlc-player'),
    // From workspace root (if cwd is correct)
    path.join(process.cwd(), 'core/vlc-player'),
    // Monorepo root from apps/desktop
    path.join(process.cwd(), '../../core/vlc-player'),
  ];

  console.error('[VLC Standalone] Searching for VLC module...');
  console.error('[VLC Standalone] __dirname:', __dirname);
  console.error('[VLC Standalone] process.cwd():', process.cwd());

  for (const modulePath of possiblePaths) {
    console.error('[VLC Standalone] Checking:', modulePath);
    if (fs.existsSync(modulePath)) {
      console.error('[VLC Standalone] ✅ Found at:', modulePath);
      return modulePath;
    }
  }

  console.error('[VLC Standalone] ❌ VLC module not found in any path');
  throw new Error('VLC module not found');
}

/**
 * Load VLC native module
 */
function loadVlcModule() {
  if (vlcModule) return vlcModule;

  try {
    const modulePath = findVlcModulePath();
    console.error('[VLC Standalone] Attempting to require:', modulePath);
    vlcModule = require(modulePath);
    console.error('[VLC Standalone] ✅ Module loaded successfully');
    sendLog('info', `VLC module loaded from: ${modulePath}`);
    return vlcModule;
  } catch (error) {
    console.error('[VLC Standalone] ❌ Failed to require module:', error.message);
    console.error('[VLC Standalone] Error stack:', error.stack);
    sendLog('error', `Failed to load VLC module: ${error.message}`);
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

  // Create player (default mode - window rendering)
  player = vlc.createPlayer();

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

  // Use unified event callback - forward entire event data to parent
  player.setEventCallback((eventData) => {
    // Forward the unified event structure directly
    sendEvent('vlcEvent', eventData);
  });
}

/**
 * Handle incoming messages from parent process
 */
function handleMessage(message) {
  const { type, method, args = [], id } = message;

  if (type !== 'method') {
    sendLog('warn', `Unknown message type: ${type}`);
    return;
  }

  try {
    let result;

    switch (method) {
      // Initialization
      case 'init':
        initializePlayer();
        result = { success: true };
        break;

      // Unified Window API
      case 'window': {
        if (!player) {
          throw new Error('Player not initialized');
        }
        // args[0] is the options object
        const options = args[0];
        result = player.window(options);
        sendLog('debug', `Window called with options: ${JSON.stringify(options)}`);
        break;
      }

      // Unified API Methods
      case 'open':
        if (!player) throw new Error('Player not initialized');
        result = player.open(args[0]);
        sendLog('info', `Open called with options: ${JSON.stringify(args[0])}`);
        break;

      case 'playback':
        if (!player) throw new Error('Player not initialized');
        result = player.playback(args[0]);
        sendLog('debug', `Playback called with options: ${JSON.stringify(args[0])}`);
        break;

      case 'audio':
        if (!player) throw new Error('Player not initialized');
        result = player.audio(args[0]);
        sendLog('debug', `Audio called with options: ${JSON.stringify(args[0])}`);
        break;

      case 'video':
        if (!player) throw new Error('Player not initialized');
        result = player.video(args[0]);
        sendLog('debug', `Video called with options: ${JSON.stringify(args[0])}`);
        break;

      case 'subtitle':
        if (!player) throw new Error('Player not initialized');
        result = player.subtitle(args[0]);
        sendLog('debug', `Subtitle called with options: ${JSON.stringify(args[0])}`);
        break;

      case 'shortcut':
        if (!player) throw new Error('Player not initialized');
        result = player.shortcut(args[0]);
        sendLog('debug', `Shortcut called with options: ${JSON.stringify(args[0])}`);
        break;

      case 'getMediaInfo':
        if (!player) throw new Error('Player not initialized');
        result = player.getMediaInfo();
        sendLog('debug', 'GetMediaInfo called');
        break;

      case 'getPlayerInfo':
        if (!player) throw new Error('Player not initialized');
        result = player.getPlayerInfo();
        sendLog('debug', 'GetPlayerInfo called');
        break;

      default:
        throw new Error(`Unknown method: ${method}`);
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
  send({ type: 'result', id, result });
}

/**
 * Send error message to parent process
 */
function sendError(id, error) {
  send({
    type: 'error',
    id,
    error: error.message,
    stack: error.stack,
  });
}

/**
 * Send event to parent process
 */
function sendEvent(event, data) {
  send({ type: 'event', event, data });
}

/**
 * Send log message to parent process
 */
function sendLog(level, message, data = null) {
  send({ type: 'log', level, message, data });
}

// JSON output stream (fd 3 if specified, otherwise stdout)
const jsonFd = process.env.VLC_JSON_FD ? parseInt(process.env.VLC_JSON_FD) : 1;
const jsonStream = jsonFd === 1 ? process.stdout : fs.createWriteStream(null, { fd: jsonFd });

/**
 * Send JSON message to parent via JSON stream (fd 3 or stdout)
 * Uses JSON Lines format (newline-delimited JSON)
 */
function send(obj) {
  jsonStream.write(JSON.stringify(obj) + '\n');
}

/**
 * Main process entry point
 */
function main() {
  sendLog('info', 'VLC standalone process starting...');
  sendLog('info', `Process ID: ${process.pid}`);
  sendLog('info', `Node version: ${process.version}`);
  sendLog('info', `Platform: ${process.platform}`);
  sendLog('info', `DISPLAY: ${process.env.DISPLAY || 'not set'}`);

  // Setup STDIN reader (JSON Lines format)
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', (line) => {
    try {
      const message = JSON.parse(line);
      handleMessage(message);
    } catch (err) {
      sendLog('error', `Failed to parse message: ${err.message}`, line);
    }
  });

  // Handle process termination
  process.on('SIGTERM', () => {
    sendLog('info', 'Received SIGTERM, cleaning up...');
    cleanup();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    sendLog('info', 'Received SIGINT, cleaning up...');
    cleanup();
    process.exit(0);
  });

  process.on('uncaughtException', (error) => {
    sendLog('error', `Uncaught exception: ${error.message}`, error.stack);
    cleanup();
    process.exit(1);
  });

  // Send ready signal to parent
  send({ type: 'ready' });
  sendLog('info', 'VLC standalone process ready and waiting for commands');
}

/**
 * Cleanup resources
 */
function cleanup() {
  if (player) {
    try {
      player.stop();
      player.dispose();
      sendLog('info', 'Player disposed successfully');
    } catch (error) {
      sendLog('error', `Cleanup error: ${error.message}`);
    }
  }
}

// Start the process
main();
