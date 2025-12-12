import { contextBridge, ipcRenderer } from 'electron'
import type {
  IPCBridge,
  FileReadOptions,
  FileWriteOptions,
  ReadDirOptions,
  FetchOptions,
  StreamOptions,
  DialogOpenFileOptions,
  DialogOpenDirectoryOptions,
  DialogSaveFileOptions
} from '../../src/types/ipc'

// File System API
const fsAPI = {
  readFile: (path: string, options?: FileReadOptions) =>
    ipcRenderer.invoke('fs:readFile', path, options),

  writeFile: (path: string, content: string, options?: FileWriteOptions) =>
    ipcRenderer.invoke('fs:writeFile', path, content, options),

  readDir: (path: string, options?: ReadDirOptions) =>
    ipcRenderer.invoke('fs:readDir', path, options),

  mkdir: (path: string, recursive = true) => ipcRenderer.invoke('fs:mkdir', path, recursive),

  delete: (path: string) => ipcRenderer.invoke('fs:delete', path),

  move: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:move', oldPath, newPath),

  exists: (path: string) => ipcRenderer.invoke('fs:exists', path),

  stats: (path: string) => ipcRenderer.invoke('fs:stats', path),

  watch: async (
    path: string,
    callback: (event: string, filename: string) => void
  ): Promise<() => void> => {
    const watcherId = await ipcRenderer.invoke('fs:watch', path)

    // Listen for file changes
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { path: string; event: string; filename: string }
    ): void => {
      if (data.path === path) {
        callback(data.event, data.filename)
      }
    }

    ipcRenderer.on('fs:watch:change', listener)

    // Return unwatch function
    return async (): Promise<void> => {
      ipcRenderer.removeListener('fs:watch:change', listener)
      await ipcRenderer.invoke('fs:unwatch', watcherId)
    }
  }
}

// Dialog API
const dialogAPI = {
  openFile: (options?: DialogOpenFileOptions) =>
    ipcRenderer.invoke('dialog:openFile', options),

  openDirectory: (options?: DialogOpenDirectoryOptions) =>
    ipcRenderer.invoke('dialog:openDirectory', options),

  saveFile: (options?: DialogSaveFileOptions) =>
    ipcRenderer.invoke('dialog:saveFile', options)
}

// App API
const appAPI = {
  getPath: (name: 'userData' | 'appData' | 'temp' | 'home') =>
    ipcRenderer.invoke('app:getPath', name)
}

// Fetch API
const fetchAPI = {
  request: <T = unknown>(url: string, options?: FetchOptions) =>
    ipcRenderer.invoke('fetch:request', url, options).then((response) => response as T),

  stream: async (url: string, options: StreamOptions): Promise<void> => {
    // Setup stream listeners
    const chunkListener = (
      _event: Electron.IpcRendererEvent,
      data: { url: string; chunk: string }
    ): void => {
      if (data.url === url && options.onChunk) {
        options.onChunk(data.chunk)
      }
    }

    const errorListener = (
      _event: Electron.IpcRendererEvent,
      data: { url: string; error: string }
    ): void => {
      if (data.url === url && options.onError) {
        options.onError(new Error(data.error))
      }
    }

    const completeListener = (
      _event: Electron.IpcRendererEvent,
      data: { url: string }
    ): void => {
      if (data.url === url) {
        // Cleanup listeners
        ipcRenderer.removeListener('fetch:stream:chunk', chunkListener)
        ipcRenderer.removeListener('fetch:stream:error', errorListener)
        ipcRenderer.removeListener('fetch:stream:complete', completeListener)

        if (options.onComplete) {
          options.onComplete()
        }
      }
    }

    // Register listeners
    ipcRenderer.on('fetch:stream:chunk', chunkListener)
    ipcRenderer.on('fetch:stream:error', errorListener)
    ipcRenderer.on('fetch:stream:complete', completeListener)

    // Start streaming
    try {
      await ipcRenderer.invoke('fetch:stream', url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        timeout: options.timeout
      })
    } catch (error) {
      // Cleanup on error
      ipcRenderer.removeListener('fetch:stream:chunk', chunkListener)
      ipcRenderer.removeListener('fetch:stream:error', errorListener)
      ipcRenderer.removeListener('fetch:stream:complete', completeListener)
      throw error
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', {
      fs: fsAPI,
      fetch: fetchAPI,
      http: fetchAPI,
      dialog: dialogAPI,
      app: appAPI
    } as IPCBridge)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = {
    fs: fsAPI,
    fetch: fetchAPI,
    http: fetchAPI,
    dialog: dialogAPI,
    app: appAPI
  } as IPCBridge
}
