const { WebSocketServer } = require('ws');
const crypto = require('crypto');

class P2PServer {
  constructor() {
    this.wss = null;
    this.port = 8080;
    this.deviceId = this.generateDeviceId();
    this.deviceName = 'Zenith TV Desktop';
    this.clients = new Map(); // deviceId -> ws connection
    this.pendingPairings = new Map(); // deviceId -> PIN
  }

  generateDeviceId() {
    return crypto.randomBytes(16).toString('hex');
  }

  generatePIN() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  start(port = 8080) {
    this.port = port;

    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on('connection', (ws, req) => {
      console.log('[P2P] New connection from:', req.socket.remoteAddress);

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('[P2P] Failed to parse message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        // Remove client from map
        for (const [deviceId, client] of this.clients.entries()) {
          if (client === ws) {
            this.clients.delete(deviceId);
            console.log('[P2P] Client disconnected:', deviceId);
            break;
          }
        }
      });

      ws.on('error', (error) => {
        console.error('[P2P] WebSocket error:', error);
      });
    });

    console.log(`[P2P] Server started on port ${this.port}`);
  }

  handleMessage(ws, message) {
    const { type } = message;

    switch (type) {
      case 'discover':
        this.handleDiscover(ws, message);
        break;
      case 'pair_request':
        this.handlePairRequest(ws, message);
        break;
      case 'pair_response':
        this.handlePairResponse(ws, message);
        break;
      case 'play':
        this.handlePlay(message);
        break;
      case 'pause':
        this.handlePause(message);
        break;
      case 'seek':
        this.handleSeek(message);
        break;
      case 'set_volume':
        this.handleSetVolume(message);
        break;
      default:
        this.sendError(ws, `Unknown message type: ${type}`);
    }
  }

  handleDiscover(ws, message) {
    const { device } = message;

    // Send our device info back
    this.send(ws, {
      type: 'discover',
      device: {
        id: this.deviceId,
        name: this.deviceName,
        type: 'desktop',
        ip: 'localhost',
        port: this.port,
      },
    });
  }

  handlePairRequest(ws, message) {
    const { pairing } = message;
    const { deviceId, deviceName, pin } = pairing;

    // Generate PIN and store pending pairing
    const generatedPIN = this.generatePIN();
    this.pendingPairings.set(deviceId, {
      pin: generatedPIN,
      deviceName,
      ws,
    });

    // Send pairing request to renderer (show PIN dialog)
    if (this.onPairingRequest) {
      this.onPairingRequest({
        deviceId,
        deviceName,
        pin: generatedPIN,
      });
    }

    console.log(`[P2P] Pairing request from ${deviceName}, PIN: ${generatedPIN}`);
  }

  acceptPairing(deviceId, userPin) {
    const pending = this.pendingPairings.get(deviceId);

    if (!pending) {
      console.error('[P2P] No pending pairing found for device:', deviceId);
      return false;
    }

    if (pending.pin !== userPin) {
      console.error('[P2P] Invalid PIN');
      this.send(pending.ws, {
        type: 'pair_response',
        accepted: false,
        deviceId,
      });
      this.pendingPairings.delete(deviceId);
      return false;
    }

    // PIN is correct, accept pairing
    this.clients.set(deviceId, pending.ws);
    this.pendingPairings.delete(deviceId);

    this.send(pending.ws, {
      type: 'pair_response',
      accepted: true,
      deviceId: this.deviceId,
    });

    console.log('[P2P] Pairing accepted for device:', deviceId);
    return true;
  }

  rejectPairing(deviceId) {
    const pending = this.pendingPairings.get(deviceId);

    if (pending) {
      this.send(pending.ws, {
        type: 'pair_response',
        accepted: false,
        deviceId,
      });
      this.pendingPairings.delete(deviceId);
    }
  }

  handlePlay(message) {
    if (this.onPlayCommand) {
      this.onPlayCommand(message.item, message.position);
    }
  }

  handlePause(message) {
    if (this.onPauseCommand) {
      this.onPauseCommand();
    }
  }

  handleSeek(message) {
    if (this.onSeekCommand) {
      this.onSeekCommand(message.position);
    }
  }

  handleSetVolume(message) {
    if (this.onSetVolumeCommand) {
      this.onSetVolumeCommand(message.volume);
    }
  }

  // Send state update to all connected clients
  broadcastState(state) {
    const message = {
      type: 'state_update',
      state,
    };

    for (const [deviceId, ws] of this.clients.entries()) {
      this.send(ws, message);
    }
  }

  send(ws, message) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendError(ws, errorMessage) {
    this.send(ws, {
      type: 'error',
      message: errorMessage,
    });
  }

  stop() {
    if (this.wss) {
      this.wss.close();
      this.clients.clear();
      this.pendingPairings.clear();
      console.log('[P2P] Server stopped');
    }
  }

  // Event handlers (set from main.js)
  onPairingRequest = null;
  onPlayCommand = null;
  onPauseCommand = null;
  onSeekCommand = null;
  onSetVolumeCommand = null;
}

module.exports = { P2PServer };
