import { WebSocketServer, WebSocket } from 'ws'
import { randomBytes } from 'crypto'
import type { IncomingMessage } from 'http'

export interface P2PEventHandlers {
  onConnection?: (connectionId: string, ip: string) => void
  onMessage?: (connectionId: string, message: unknown) => void
  onDisconnection?: (connectionId: string) => void
}

export class P2PServer {
  private wss: WebSocketServer | null = null
  private port: number = 8080
  private deviceId: string
  private deviceName: string = 'Zenith TV Desktop'
  private clients: Map<string, WebSocket> = new Map()
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

  start(port: number = 8080): void {
    this.port = port
    this.wss = new WebSocketServer({ port: this.port })

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const ip = req.socket.remoteAddress || 'unknown'
      console.log('[P2P] New connection from:', ip)

      // Wait for initial handshake or assign temporary ID
      // For now, we'll assign a temporary ID until the client identifies itself
      // In a real scenario, we might want to wait for a "hello" message with the client's UUID
      const connectionId = randomBytes(8).toString('hex')
      this.clients.set(connectionId, ws)

      if (this.eventHandlers.onConnection) {
        this.eventHandlers.onConnection(connectionId, ip)
      }

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString())

          // Check if this is a handshake/identity message to update connectionId
          // For simplicity in this phase, we assume the client sends its ID in the first message
          // or we just use the server-assigned ID.
          // Let's stick to the server-assigned ID for now to keep it simple, 
          // or if the message contains 'deviceId', we could map it.

          if (this.eventHandlers.onMessage) {
            this.eventHandlers.onMessage(connectionId, message)
          }
        } catch (error) {
          console.error('[P2P] Failed to parse message:', error)
          this.sendError(ws, 'Invalid message format')
        }
      })

      ws.on('close', () => {
        this.clients.delete(connectionId)
        console.log('[P2P] Client disconnected:', connectionId)
        if (this.eventHandlers.onDisconnection) {
          this.eventHandlers.onDisconnection(connectionId)
        }
      })

      ws.on('error', (error: Error) => {
        console.error('[P2P] WebSocket error:', error)
      })
    })

    console.log(`[P2P] Server started on port ${this.port}`)
  }

  send(connectionId: string, message: unknown): boolean {
    const ws = this.clients.get(connectionId)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
      return true
    }
    return false
  }

  broadcast(message: unknown): void {
    const serialized = JSON.stringify(message)
    for (const ws of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized)
      }
    }
  }

  getDeviceInfo(): { id: string; name: string; port: number } {
    return {
      id: this.deviceId,
      name: this.deviceName,
      port: this.port
    }
  }

  private sendError(ws: WebSocket, errorMessage: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        message: errorMessage
      }))
    }
  }

  stop(): void {
    if (this.wss) {
      this.wss.close()
      this.clients.clear()
      console.log('[P2P] Server stopped')
    }
  }
}
