/**
 * VLC Process Manager
 *
 * Manages the lifecycle of the standalone VLC Node.js process.
 * Handles communication via JSON Lines protocol (stdin/stdout).
 * Provides promise-based API matching the existing vlcHandlers interface.
 */

const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const path = require('path');
const readline = require('readline');

class VlcProcessManager extends EventEmitter {
  constructor() {
    super();

    this.process = null;
    this.ready = false;
    this.pendingCalls = new Map();
    this.callId = 0;
    this.restartCount = 0;
    this.maxRestarts = 3;
  }

  /**
   * Start the VLC standalone process
   * @returns {Promise<void>}
   */
  async start() {
    if (this.process) {
      throw new Error('Process already started');
    }

    return new Promise((resolve, reject) => {
      // VLC standalone process path resolution
      // Development: vite-plugin-static-copy → out/main/vlc/
      // Production: electron-builder extraResources → resources/vlc/
      const isDev = process.env.NODE_ENV !== 'production';

      let scriptPath;
      if (isDev) {
        // Development: vlcProcessManager bundled in out/main/index.js
        // __dirname = out/main, standalone script at out/main/vlc/
        scriptPath = path.join(__dirname, 'vlc/vlcStandaloneProcess.cjs');
      } else {
        // Production: electron-builder copies to resources/
        scriptPath = path.join(process.resourcesPath, 'vlc/vlcStandaloneProcess.cjs');
      }

      console.log('[VLC Manager] Starting standalone process:', scriptPath);
      console.log('[VLC Manager] __dirname:', __dirname);
      console.log('[VLC Manager] isDev:', isDev);

      // Spawn standalone Node.js process (NOT fork - fully isolated)
      // stdio: stdin=pipe, stdout=inherit(to suppress VLC debug), stderr=pipe, fd3=pipe(for JSON)
      this.process = spawn('node', [scriptPath], {
        stdio: ['pipe', 'inherit', 'pipe', 'pipe'], // stdin, stdout(inherit), stderr, fd3(JSON output)
        env: {
          ...process.env,
          DISPLAY: process.env.DISPLAY, // Critical: Inherit X11 DISPLAY
          VLC_JSON_FD: '3', // Tell child to use fd 3 for JSON output
        },
      });

      console.log('[VLC Manager] Process spawned with PID:', this.process.pid);

      // Setup FD3 reader for JSON Lines format (fd 3 is at index 3 in stdio array)
      const jsonStream = this.process.stdio[3];
      const rl = readline.createInterface({
        input: jsonStream,
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        try {
          const msg = JSON.parse(line);
          this._handleMessage(msg);
        } catch (err) {
          console.error('[VLC Manager] Failed to parse message:', err, line);
        }
      });

      // STDERR forwarding for debugging
      this.process.stderr.on('data', (data) => {
        console.error('[VLC Process stderr]', data.toString());
      });

      // Exit handling
      this.process.on('exit', (code, signal) => {
        console.log('[VLC Manager] Process exited:', code, signal);
        this.ready = false;
        this.process = null;

        // Reject all pending calls
        for (const [id, { reject }] of this.pendingCalls) {
          reject(new Error('Process exited unexpectedly'));
        }
        this.pendingCalls.clear();

        this.emit('exit', { code, signal });

        // Auto-restart if crash (not intentional shutdown)
        if (code !== 0 && code !== null && this.restartCount < this.maxRestarts) {
          console.log('[VLC Manager] Attempting auto-restart...');
          this.restartCount++;
          setTimeout(() => this.start().catch(console.error), 1000);
        }
      });

      this.process.on('error', (err) => {
        console.error('[VLC Manager] Process error:', err);
        reject(err);
      });

      // Wait for ready signal
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for VLC process ready signal'));
      }, 10000);

      const readyListener = (msg) => {
        if (msg.type === 'ready') {
          clearTimeout(timeout);
          this.removeListener('message', readyListener);
          this.ready = true;
          this.restartCount = 0;
          console.log('[VLC Manager] Process ready');
          resolve();
        }
      };

      this.on('message', readyListener);
    });
  }

  /**
   * Stop the VLC process
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.process) return;

    return new Promise((resolve) => {
      const cleanup = () => {
        this.process = null;
        this.ready = false;
        this.pendingCalls.clear();
        resolve();
      };

      // Force kill after 5 seconds
      const killTimeout = setTimeout(() => {
        if (this.process) {
          console.warn('[VLC Manager] Force killing process');
          this.process.kill('SIGKILL');
        }
        cleanup();
      }, 5000);

      this.process.once('exit', () => {
        clearTimeout(killTimeout);
        cleanup();
      });

      // Send SIGTERM for graceful shutdown
      this.process.kill('SIGTERM');
    });
  }

  /**
   * Restart the VLC process
   * @returns {Promise<void>}
   */
  async restart() {
    await this.stop();
    await this.start();
  }

  /**
   * Call a method on the VLC player
   * @param {string} method - Method name
   * @param {...any} args - Method arguments
   * @returns {Promise<any>} Method result
   */
  async call(method, ...args) {
    if (!this.ready) {
      throw new Error('VLC process not ready');
    }

    return new Promise((resolve, reject) => {
      const id = ++this.callId;
      const message = { type: 'method', method, args, id };

      // Store pending call
      this.pendingCalls.set(id, { resolve, reject });

      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingCalls.delete(id);
        reject(new Error(`Method call timeout: ${method}`));
      }, 30000); // 30 second timeout

      this.pendingCalls.get(id).timeout = timeout;

      // Send JSON line via STDIN
      this.process.stdin.write(JSON.stringify(message) + '\n');
    });
  }

  /**
   * Update window bounds using unified API
   * @param {Object} options - Window options
   * @returns {Promise<boolean>}
   */
  async updateWindow(options) {
    if (!this.ready) return false;

    try {
      return await this.call('window', options);
    } catch (error) {
      console.error('[VLC Manager] Failed to update window:', error);
      return false;
    }
  }

  /**
   * Handle incoming messages from child process
   * @private
   */
  _handleMessage(msg) {
    this.emit('message', msg);

    switch (msg.type) {
      case 'result':
        this._handleResult(msg.id, msg.result);
        break;

      case 'error':
        this._handleError(msg.id, msg);
        break;

      case 'event':
        // Forward VLC events to listeners
        this.emit(msg.event, msg.data);
        break;

      case 'log':
        this._handleLog(msg);
        break;

      case 'ready':
        // Handled in start() method
        break;

      default:
        console.warn('[VLC Manager] Unknown message type:', msg.type);
    }
  }

  /**
   * Handle result message
   * @private
   */
  _handleResult(id, result) {
    const pending = this.pendingCalls.get(id);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(result);
      this.pendingCalls.delete(id);
    }
  }

  /**
   * Handle error message
   * @private
   */
  _handleError(id, msg) {
    const pending = this.pendingCalls.get(id);
    if (pending) {
      clearTimeout(pending.timeout);
      const err = new Error(msg.error);
      err.stack = msg.stack;
      pending.reject(err);
      this.pendingCalls.delete(id);
    }
  }

  /**
   * Handle log message
   * @private
   */
  _handleLog(msg) {
    const { level, message, data } = msg;
    const prefix = '[VLC Process]';

    switch (level) {
      case 'error':
        console.error(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'debug':
        if (process.env.DEBUG) {
          console.log(prefix, message, data || '');
        }
        break;
      case 'info':
      default:
        console.log(prefix, message, data || '');
    }
  }

  /**
   * Check if process is ready
   * @returns {boolean}
   */
  isReady() {
    return this.ready && this.process !== null;
  }

  /**
   * Get process ID
   * @returns {number|null}
   */
  getPid() {
    return this.process ? this.process.pid : null;
  }
}

module.exports = { VlcProcessManager };
