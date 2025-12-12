import { WebSocketServer, WebSocket } from 'ws'
import { randomBytes } from 'crypto'
import http from 'http'
import type { IncomingMessage, ServerResponse } from 'http'

export interface P2PEventHandlers {
  onConnection?: (connectionId: string, ip: string) => void
  onMessage?: (connectionId: string, message: unknown) => void
  onDisconnection?: (connectionId: string) => void
}

export class P2PServer {
  private wss: WebSocketServer | null = null
  private httpServer: http.Server | null = null
  private port: number = 8080
  private deviceId: string
  private deviceName: string = 'Zenith TV Desktop'
  private clients: Map<string, WebSocket> = new Map()
  private eventHandlers: P2PEventHandlers = {}

  constructor() {
    this.deviceId = this.generateDeviceId()
  }

  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Handle discovery endpoint
    if (req.method === 'GET' && req.url === '/api/discover') {
      const response = {
        deviceId: this.deviceId,
        deviceName: this.deviceName,
        port: this.port,
        version: '1.0.0',
        role: 'controller'
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
      return
    }

    // 404 for other routes
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  }

  setEventHandlers(handlers: P2PEventHandlers): void {
    this.eventHandlers = handlers
  }

  private generateDeviceId(): string {
    return randomBytes(16).toString('hex')
  }

  start(port: number = 8080, deviceName?: string): void {
    this.port = port
    if (deviceName) {
      this.deviceName = deviceName
    }

    // Create HTTP server with request handler
    this.httpServer = http.createServer((req, res) => this.handleHttpRequest(req, res))

    // Create WebSocket server on top of HTTP server
    this.wss = new WebSocketServer({ server: this.httpServer })

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

    // Start listening
    this.httpServer.listen(this.port, () => {
      console.log(`[P2P] Server started on port ${this.port}`)
      console.log(`[P2P] Device: ${this.deviceName} (${this.deviceId})`)
      console.log(`[P2P] Discovery endpoint: http://localhost:${this.port}/api/discover`)
    })
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
    }
    if (this.httpServer) {
      this.httpServer.close()
    }
    this.clients.clear()
    console.log('[P2P] Server stopped')
  }
}
