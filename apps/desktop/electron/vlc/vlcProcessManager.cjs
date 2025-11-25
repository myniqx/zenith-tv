/**
 * VLC Process Manager
 *
 * Manages the VLC child process lifecycle, handles IPC communication,
 * and provides a promise-based API for method calls.
 */

const { fork } = require('child_process');
const { EventEmitter } = require('events');
const { MessageChannel } = require('worker_threads');
const path = require('path');
const protocol = require('./messageProtocol.cjs');

class VlcProcessManager extends EventEmitter {
  constructor() {
    super();

    this.process = null;
    this.ready = false;
    this.pendingCalls = new Map();
    this.framePort = null;
    this.restartCount = 0;
    this.maxRestarts = 3;
  }

  /**
   * Start the VLC child process
   * @returns {Promise<void>}
   */
  async start() {
    if (this.process) {
      throw new Error('Process already started');
    }

    return new Promise((resolve, reject) => {
      // Find vlcWrapper.cjs in both development and production
      let wrapperPath;

      // Development: __dirname = electron/vlc/
      // Production: __dirname = out/main/ (bundled, no vlc subdir)
      const devPath = path.join(__dirname, 'vlcWrapper.cjs');
      const prodPath = path.join(__dirname, 'vlc', 'vlcWrapper.cjs');

      if (require('fs').existsSync(devPath)) {
        wrapperPath = devPath;
      } else if (require('fs').existsSync(prodPath)) {
        wrapperPath = prodPath;
      } else {
        throw new Error('vlcWrapper.cjs not found in: ' + devPath + ' or ' + prodPath);
      }

      console.log('[VLC Process] Starting child process from:', wrapperPath);

      // Fork the child process
      this.process = fork(wrapperPath, [], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || 'production'
        }
      });

      console.log('[VLC Process] Child process spawned with PID:', this.process.pid);

      // Setup message handling
      this.process.on('message', this._handleMessage.bind(this));

      // Setup error handling
      this.process.on('error', (error) => {
        console.error('[VLC Process] Error:', error);
        this.emit('error', error);
        reject(error);
      });

      // Setup exit handling
      this.process.on('exit', (code, signal) => {
        console.log('[VLC Process] Exited with code', code, 'signal', signal);
        this.ready = false;
        this.process = null;

        // Reject all pending calls
        for (const [id, { reject }] of this.pendingCalls.entries()) {
          reject(new Error('Process exited unexpectedly'));
        }
        this.pendingCalls.clear();

        this.emit('exit', { code, signal });

        // Auto-restart if not intentional shutdown
        if (code !== 0 && this.restartCount < this.maxRestarts) {
          console.log('[VLC Process] Attempting auto-restart...');
          this.restartCount++;
          setTimeout(() => this.start().catch(console.error), 1000);
        }
      });

      // Forward stdout/stderr for debugging
      if (this.process.stdout) {
        this.process.stdout.on('data', (data) => {
          console.log('[VLC Process stdout]', data.toString());
        });
      }

      if (this.process.stderr) {
        this.process.stderr.on('data', (data) => {
          console.error('[VLC Process stderr]', data.toString());
        });
      }

      // Wait for ready signal
      const readyTimeout = setTimeout(() => {
        console.error('[VLC Process] Timeout waiting for ready signal');
        this.process.off('message', readyListener);
        reject(new Error('VLC process failed to start within 10 seconds'));
      }, 10000);

      const readyListener = (msg) => {
        console.log('[VLC Process] Received message during init:', msg);
        if (msg.type === protocol.TO_MAIN.READY) {
          clearTimeout(readyTimeout);
          this.process.off('message', readyListener);
          this.ready = true;
          this.restartCount = 0;
          console.log('[VLC Process] Ready signal received');
          resolve();
        }
        // Keep listening for other message types (LOG, etc.) until READY arrives
      };

      // Use 'on' instead of 'once' to keep listening until READY arrives
      this.process.on('message', readyListener);
    });
  }

  /**
   * Stop the VLC child process
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.process) {
      return;
    }

    return new Promise((resolve) => {
      const cleanup = () => {
        this.process = null;
        this.ready = false;
        this.pendingCalls.clear();
        if (this.framePort) {
          this.framePort.close();
          this.framePort = null;
        }
        resolve();
      };

      // Give process 5 seconds to exit gracefully
      const killTimeout = setTimeout(() => {
        if (this.process) {
          console.warn('[VLC Process] Force killing process');
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
   * Restart the VLC child process
   * @returns {Promise<void>}
   */
  async restart() {
    await this.stop();
    await this.start();
  }

  /**
   * Call a method on the VLC player
   * @param {string} method - Method name from protocol.TO_CHILD
   * @param {...any} args - Method arguments
   * @returns {Promise<any>} Method result
   */
  async call(method, ...args) {
    if (!this.ready) {
      throw new Error('Process not ready');
    }

    return new Promise((resolve, reject) => {
      const message = protocol.createMethodCall(method, args);
      const { id } = message;

      // Store pending call
      this.pendingCalls.set(id, { resolve, reject });

      // Set timeout for call
      const timeout = setTimeout(() => {
        this.pendingCalls.delete(id);
        reject(new Error(`Method call timeout: ${method}`));
      }, 30000); // 30 second timeout

      // Store timeout so we can clear it on response
      this.pendingCalls.get(id).timeout = timeout;

      // Send message to child process
      this.process.send(message);
    });
  }

  /**
   * Setup MessagePort for frame transfer
   * @returns {MessagePort} Port to send to renderer
   */
  setupFramePort() {
    if (this.framePort) {
      this.framePort.close();
    }

    // Create MessageChannel
    const { port1, port2 } = new MessageChannel();

    // Port1 goes to child process (transferable)
    // Using postMessage with transferList for MessagePort
    this.process.postMessage({ type: 'frame-port', port: port1 }, [port1]);

    // Port2 will be sent to renderer
    this.framePort = port2;

    console.log('[VLC Process] Frame MessagePort created');

    return port2;
  }

  /**
   * Handle incoming messages from child process
   * @private
   */
  _handleMessage(message) {
    const { type, id } = message;

    switch (type) {
      case protocol.TO_MAIN.RESULT:
        this._handleResult(id, message.result);
        break;

      case protocol.TO_MAIN.ERROR:
        this._handleError(id, message);
        break;

      case protocol.TO_MAIN.EVENT:
        this._handleEvent(message);
        break;

      case protocol.TO_MAIN.LOG:
        this._handleLog(message);
        break;

      case protocol.TO_MAIN.READY:
        // Handled in start() method
        break;

      default:
        console.warn('[VLC Process] Unknown message type:', type);
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
  _handleError(id, message) {
    const pending = this.pendingCalls.get(id);
    if (pending) {
      clearTimeout(pending.timeout);
      const error = new Error(message.error);
      if (message.stack) {
        error.stack = message.stack;
      }
      pending.reject(error);
      this.pendingCalls.delete(id);
    }
  }

  /**
   * Handle event message
   * @private
   */
  _handleEvent(message) {
    const { event, data } = message;

    // Emit event with VLC prefix
    this.emit(`vlc:${event}`, data);

    // Also emit raw event name
    this.emit(event, data);
  }

  /**
   * Handle log message
   * @private
   */
  _handleLog(message) {
    const { level, message: logMessage, data } = message;
    const prefix = '[VLC Process]';

    switch (level) {
      case 'error':
        console.error(prefix, logMessage, data || '');
        break;
      case 'warn':
        console.warn(prefix, logMessage, data || '');
        break;
      case 'debug':
        if (process.env.DEBUG) {
          console.log(prefix, logMessage, data || '');
        }
        break;
      case 'info':
      default:
        console.log(prefix, logMessage, data || '');
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
