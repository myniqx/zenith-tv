import { WebSocketServer, WebSocket } from 'ws'
import { randomBytes } from 'crypto'
import type { IncomingMessage } from 'http'

interface P2PMessage {
  type: string
  [key: string]: unknown
}

interface PairingInfo {
  pin: string
  deviceName: string
  ws: WebSocket
}

export interface P2PEventHandlers {
  onPairingRequest?: (pairing: { deviceId: string; deviceName: string; pin: string }) => void
  onPlayCommand?: (item: unknown, position?: number) => void
  onPauseCommand?: () => void
  onSeekCommand?: (position: number) => void
  onSetVolumeCommand?: (volume: number) => void
}

export class P2PServer {
  private wss: WebSocketServer | null = null
  private port: number = 8080
  private deviceId: string
  private deviceName: string = 'Zenith TV Desktop'
  private clients: Map<string, WebSocket> = new Map()
  private pendingPairings: Map<string, PairingInfo> = new Map()
  private eventHandlers: P2PEventHandlers = {}

  constructor() {
    this.deviceId = this.generateDeviceId()
  }

  setEventHandlers(handlers: P2PEventHandlers): void {
    this.eventHandlers = handlers
  }

  private generateDeviceId(): string {
    return randomBytes(16).toString('hex')
  }

  private generatePIN(): string {
    return Math.floor(1000 + Math.random() * 9000).toString()
  }

  start(port: number = 8080): void {
    this.port = port
    this.wss = new WebSocketServer({ port: this.port })

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      console.log('[P2P] New connection from:', req.socket.remoteAddress)

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as P2PMessage
          this.handleMessage(ws, message)
        } catch (error) {
          console.error('[P2P] Failed to parse message:', error)
          this.sendError(ws, 'Invalid message format')
        }
      })

      ws.on('close', () => {
        for (const [deviceId, client] of this.clients.entries()) {
          if (client === ws) {
            this.clients.delete(deviceId)
            console.log('[P2P] Client disconnected:', deviceId)
            break
          }
        }
      })

      ws.on('error', (error: Error) => {
        console.error('[P2P] WebSocket error:', error)
      })
    })

    console.log(`[P2P] Server started on port ${this.port}`)
  }

  private handleMessage(ws: WebSocket, message: P2PMessage): void {
    const { type } = message

    switch (type) {
      case 'discover':
        this.handleDiscover(ws, message)
        break
      case 'pair_request':
        this.handlePairRequest(ws, message)
        break
      case 'pair_response':
        this.handlePairResponse(ws, message)
        break
      case 'play':
        this.handlePlay(message)
        break
      case 'pause':
        this.handlePause(message)
        break
      case 'seek':
        this.handleSeek(message)
        break
      case 'set_volume':
        this.handleSetVolume(message)
        break
      default:
        this.sendError(ws, `Unknown message type: ${type}`)
    }
  }

  private handleDiscover(ws: WebSocket, _message: P2PMessage): void {
    this.send(ws, {
      type: 'discover',
      device: {
        id: this.deviceId,
        name: this.deviceName,
        type: 'desktop',
        ip: 'localhost',
        port: this.port
      }
    })
  }

  private handlePairRequest(ws: WebSocket, message: P2PMessage): void {
    const { pairing } = message as { pairing: { deviceId: string; deviceName: string; pin: string } }
    const { deviceId, deviceName } = pairing

    const generatedPIN = this.generatePIN()
    this.pendingPairings.set(deviceId, {
      pin: generatedPIN,
      deviceName,
      ws
    })

    if (this.eventHandlers.onPairingRequest) {
      this.eventHandlers.onPairingRequest({
        deviceId,
        deviceName,
        pin: generatedPIN
      })
    }

    console.log(`[P2P] Pairing request from ${deviceName}, PIN: ${generatedPIN}`)
  }

  private handlePairResponse(_ws: WebSocket, _message: P2PMessage): void {
    // Not implemented for desktop (we are the receiver)
  }

  private handlePlay(message: P2PMessage): void {
    if (this.eventHandlers.onPlayCommand) {
      const { item, position } = message as { item: unknown; position?: number }
      this.eventHandlers.onPlayCommand(item, position)
    }
  }

  private handlePause(_message: P2PMessage): void {
    if (this.eventHandlers.onPauseCommand) {
      this.eventHandlers.onPauseCommand()
    }
  }

  private handleSeek(message: P2PMessage): void {
    if (this.eventHandlers.onSeekCommand) {
      const { position } = message as { position: number }
      this.eventHandlers.onSeekCommand(position)
    }
  }

  private handleSetVolume(message: P2PMessage): void {
    if (this.eventHandlers.onSetVolumeCommand) {
      const { volume } = message as { volume: number }
      this.eventHandlers.onSetVolumeCommand(volume)
    }
  }

  acceptPairing(deviceId: string, userPin: string): boolean {
    const pending = this.pendingPairings.get(deviceId)

    if (!pending) {
      console.error('[P2P] No pending pairing found for device:', deviceId)
      return false
    }

    if (pending.pin !== userPin) {
      console.error('[P2P] Invalid PIN')
      this.send(pending.ws, {
        type: 'pair_response',
        accepted: false,
        deviceId
      })
      this.pendingPairings.delete(deviceId)
      return false
    }

    this.clients.set(deviceId, pending.ws)
    this.pendingPairings.delete(deviceId)

    this.send(pending.ws, {
      type: 'pair_response',
      accepted: true,
      deviceId: this.deviceId
    })

    console.log('[P2P] Pairing accepted for device:', deviceId)
    return true
  }

  rejectPairing(deviceId: string): void {
    const pending = this.pendingPairings.get(deviceId)

    if (pending) {
      this.send(pending.ws, {
        type: 'pair_response',
        accepted: false,
        deviceId
      })
      this.pendingPairings.delete(deviceId)
    }
  }

  broadcastState(state: unknown): void {
    const message = {
      type: 'state_update',
      state
    }

    for (const [_deviceId, ws] of this.clients.entries()) {
      this.send(ws, message)
    }
  }

  getDeviceInfo(): { id: string; name: string; port: number } {
    return {
      id: this.deviceId,
      name: this.deviceName,
      port: this.port
    }
  }

  private send(ws: WebSocket, message: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  private sendError(ws: WebSocket, errorMessage: string): void {
    this.send(ws, {
      type: 'error',
      message: errorMessage
    })
  }

  stop(): void {
    if (this.wss) {
      this.wss.close()
      this.clients.clear()
      this.pendingPairings.clear()
      console.log('[P2P] Server stopped')
    }
  }
}
