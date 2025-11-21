import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron'
import { P2PServer } from './p2pServer'

let p2pServer: P2PServer | null = null

export function registerP2PHandlers(mainWindow: BrowserWindow): void {
  // Initialize P2P server
  p2pServer = new P2PServer()

  // Setup event handlers for P2P
  p2pServer.setEventHandlers({
    onPairingRequest: (pairing) => {
      if (mainWindow) {
        mainWindow.webContents.send('p2p:pairing-request', pairing)
      }
    },
    onPlayCommand: (item, position) => {
      if (mainWindow) {
        mainWindow.webContents.send('p2p:play', { item, position })
      }
    },
    onPauseCommand: () => {
      if (mainWindow) {
        mainWindow.webContents.send('p2p:pause')
      }
    },
    onSeekCommand: (position) => {
      if (mainWindow) {
        mainWindow.webContents.send('p2p:seek', position)
      }
    },
    onSetVolumeCommand: (volume) => {
      if (mainWindow) {
        mainWindow.webContents.send('p2p:set-volume', volume)
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

  ipcMain.handle('p2p:acceptPairing', async (_event: IpcMainInvokeEvent, deviceId: string, pin: string) => {
    if (!p2pServer) return false
    return p2pServer.acceptPairing(deviceId, pin)
  })

  ipcMain.handle('p2p:rejectPairing', async (_event: IpcMainInvokeEvent, deviceId: string) => {
    if (!p2pServer) return
    p2pServer.rejectPairing(deviceId)
  })

  ipcMain.handle('p2p:broadcastState', async (_event: IpcMainInvokeEvent, state: unknown) => {
    if (!p2pServer) return
    p2pServer.broadcastState(state)
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
