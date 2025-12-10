import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron'
import { P2PServer } from './p2pServer'

let p2pServer: P2PServer | null = null

export function registerP2PHandlers(mainWindow: BrowserWindow): void {
  // Initialize P2P server
  p2pServer = new P2PServer()

  // Setup event handlers for P2P
  p2pServer.setEventHandlers({
    onConnection: (connectionId, ip) => {
      if (mainWindow) {
        mainWindow.webContents.send('p2p:connection', { connectionId, ip })
      }
    },
    onMessage: (connectionId, message) => {
      if (mainWindow) {
        mainWindow.webContents.send('p2p:message', { connectionId, message })
      }
    },
    onDisconnection: (connectionId) => {
      if (mainWindow) {
        mainWindow.webContents.send('p2p:disconnection', connectionId)
      }
    }
  })

  // Register IPC handlers
  ipcMain.handle('p2p:start', async (_event: IpcMainInvokeEvent, port?: number) => {
    if (!p2pServer) return false
    p2pServer.start(port)
    return true
  })

  ipcMain.handle('p2p:stop', async () => {
    if (!p2pServer) return false
    p2pServer.stop()
    return true
  })

  ipcMain.handle('p2p:send', async (_event: IpcMainInvokeEvent, connectionId: string, message: unknown) => {
    if (!p2pServer) return false
    return p2pServer.send(connectionId, message)
  })

  ipcMain.handle('p2p:broadcast', async (_event: IpcMainInvokeEvent, message: unknown) => {
    if (!p2pServer) return
    p2pServer.broadcast(message)
  })

  ipcMain.handle('p2p:getDeviceInfo', async () => {
    if (!p2pServer) return null
    return p2pServer.getDeviceInfo()
  })
}

export function cleanupP2P(): void {
  if (p2pServer) {
    p2pServer.stop()
    p2pServer = null
  }
}
