import { ipcMain, IpcMainInvokeEvent, dialog, BrowserWindow, app } from 'electron'

export interface DialogResult {
  canceled: boolean
  filePath?: string
  filePaths?: string[]
}

export function registerDialogHandlers(): void {
  // Get app paths
  ipcMain.handle('app:getPath', async (_event: IpcMainInvokeEvent, name: string) => {
    return app.getPath(name as any)
  })
  // Open file dialog
  ipcMain.handle(
    'dialog:openFile',
    async (
      event: IpcMainInvokeEvent,
      options?: {
        title?: string
        defaultPath?: string
        filters?: Array<{ name: string; extensions: string[] }>
        properties?: Array<'openFile' | 'multiSelections'>
      }
    ) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) {
        throw new Error('No window found')
      }

      const result = await dialog.showOpenDialog(window, {
        title: options?.title || 'Open File',
        defaultPath: options?.defaultPath,
        filters: options?.filters,
        properties: options?.properties || ['openFile']
      })

      return {
        canceled: result.canceled,
        filePath: result.filePaths[0],
        filePaths: result.filePaths
      } as DialogResult
    }
  )

  // Open directory dialog
  ipcMain.handle(
    'dialog:openDirectory',
    async (
      event: IpcMainInvokeEvent,
      options?: {
        title?: string
        defaultPath?: string
        buttonLabel?: string
      }
    ) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) {
        throw new Error('No window found')
      }

      const result = await dialog.showOpenDialog(window, {
        title: options?.title || 'Select Folder',
        defaultPath: options?.defaultPath,
        buttonLabel: options?.buttonLabel || 'Select',
        properties: ['openDirectory', 'createDirectory']
      })

      return {
        canceled: result.canceled,
        filePath: result.filePaths[0],
        filePaths: result.filePaths
      } as DialogResult
    }
  )

  // Save file dialog
  ipcMain.handle(
    'dialog:saveFile',
    async (
      event: IpcMainInvokeEvent,
      options?: {
        title?: string
        defaultPath?: string
        buttonLabel?: string
        filters?: Array<{ name: string; extensions: string[] }>
      }
    ) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) {
        throw new Error('No window found')
      }

      const result = await dialog.showSaveDialog(window, {
        title: options?.title || 'Save File',
        defaultPath: options?.defaultPath,
        buttonLabel: options?.buttonLabel || 'Save',
        filters: options?.filters
      })

      return {
        canceled: result.canceled,
        filePath: result.filePath
      } as DialogResult
    }
  )
}
