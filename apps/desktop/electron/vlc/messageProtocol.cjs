/**
 * VLC Child Process Message Protocol
 * Defines message types and structure for IPC between main process and VLC child process
 */

// Message types: Main Process → Child Process
const TO_CHILD = {
  INIT: 'init',
  PLAY: 'play',
  PAUSE: 'pause',
  STOP: 'stop',
  SEEK: 'seek',
  SET_VOLUME: 'setVolume',
  SET_RATE: 'setRate',
  SET_AUDIO_TRACK: 'setAudioTrack',
  SET_SUBTITLE_TRACK: 'setSubtitleTrack',
  SET_AUDIO_DELAY: 'setAudioDelay',
  SET_SUBTITLE_DELAY: 'setSubtitleDelay',
  CREATE_WINDOW: 'createWindow',
  RESIZE_WINDOW: 'resizeWindow',
  SET_VIDEO_CALLBACK: 'setVideoCallback',
  TOGGLE_FULLSCREEN: 'toggleFullscreen',
  GET_STATE: 'getState',
  GET_VOLUME: 'getVolume',
  GET_RATE: 'getRate',
  GET_DURATION: 'getDuration',
  GET_TIME: 'getTime',
  GET_AUDIO_TRACKS: 'getAudioTracks',
  GET_SUBTITLE_TRACKS: 'getSubtitleTracks',
  IS_PLAYING: 'isPlaying',
  IS_SEEKABLE: 'isSeekable'
};

// Message types: Child Process → Main Process
const TO_MAIN = {
  READY: 'ready',
  RESULT: 'result',
  ERROR: 'error',
  EVENT: 'event',
  LOG: 'log'
};

// Event types (VLC events forwarded to main process)
const EVENTS = {
  TIME_CHANGED: 'timeChanged',
  STATE_CHANGED: 'stateChanged',
  DURATION_CHANGED: 'durationChanged',
  POSITION_CHANGED: 'positionChanged',
  END_REACHED: 'endReached',
  ERROR: 'error',
  AUDIO_VOLUME: 'audioVolume',
  VIDEO_FRAME: 'videoFrame'
};

// VLC player states
const PLAYER_STATES = {
  IDLE: 0,
  OPENING: 1,
  BUFFERING: 2,
  PLAYING: 3,
  PAUSED: 4,
  STOPPED: 5,
  ENDED: 6,
  ERROR: 7
};

/**
 * Create a method call message (Main → Child)
 * @param {string} method - Method name from TO_CHILD
 * @param {Array} args - Method arguments
 * @param {string} id - Unique message ID for response matching
 * @returns {Object} Message object
 */
function createMethodCall(method, args = [], id = null) {
  return {
    type: 'method',
    method,
    args,
    id: id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };
}

/**
 * Create a result message (Child → Main)
 * @param {string} id - Message ID to match request
 * @param {*} result - Method result
 * @returns {Object} Message object
 */
function createResult(id, result) {
  return {
    type: TO_MAIN.RESULT,
    id,
    result
  };
}

/**
 * Create an error message (Child → Main)
 * @param {string} id - Message ID to match request
 * @param {Error|string} error - Error object or message
 * @returns {Object} Message object
 */
function createError(id, error) {
  return {
    type: TO_MAIN.ERROR,
    id,
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined
  };
}

/**
 * Create an event message (Child → Main)
 * @param {string} event - Event name from EVENTS
 * @param {*} data - Event data
 * @returns {Object} Message object
 */
function createEvent(event, data) {
  return {
    type: TO_MAIN.EVENT,
    event,
    data,
    timestamp: Date.now()
  };
}

/**
 * Create a log message (Child → Main)
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {string} message - Log message
 * @param {*} data - Additional log data
 * @returns {Object} Message object
 */
function createLog(level, message, data = null) {
  return {
    type: TO_MAIN.LOG,
    level,
    message,
    data,
    timestamp: Date.now()
  };
}

/**
 * Create a ready message (Child → Main)
 * Sent when child process has successfully initialized
 * @returns {Object} Message object
 */
function createReady() {
  return {
    type: TO_MAIN.READY,
    timestamp: Date.now()
  };
}

module.exports = {
  TO_CHILD,
  TO_MAIN,
  EVENTS,
  PLAYER_STATES,
  createMethodCall,
  createResult,
  createError,
  createEvent,
  createLog,
  createReady
};
