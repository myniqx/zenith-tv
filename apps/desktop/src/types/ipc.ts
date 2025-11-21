// Shared IPC type definitions between main and renderer processes

// File System Types
export interface FileReadOptions {
  encoding?: BufferEncoding
}

export interface FileWriteOptions {
  encoding?: BufferEncoding
  backup?: boolean // Create backup before writing
}

export interface ReadDirOptions {
  recursive?: boolean
  withFileTypes?: boolean
}

export interface FileStats {
  size: number
  created: Date
  modified: Date
  isFile: boolean
  isDirectory: boolean
}

export interface FileSystemAPI {
  readFile: (path: string, options?: FileReadOptions) => Promise<string>
  writeFile: (path: string, content: string, options?: FileWriteOptions) => Promise<void>
  readDir: (path: string, options?: ReadDirOptions) => Promise<string[]>
  mkdir: (path: string, recursive?: boolean) => Promise<void>
  delete: (path: string) => Promise<void>
  move: (oldPath: string, newPath: string) => Promise<void>
  copyFile: (sourcePath: string, destPath: string) => Promise<void>
  exists: (path: string) => Promise<boolean>
  stats: (path: string) => Promise<FileStats>
  watch: (path: string, callback: (event: string, filename: string) => void) => Promise<() => void>
}

// Fetch Types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export interface FetchOptions {
  method?: HttpMethod
  headers?: Record<string, string>
  body?: string | Record<string, unknown>
  timeout?: number
  signal?: AbortSignal
}

export interface FetchResponse<T = unknown> {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  data: T
}

export interface StreamOptions extends Omit<FetchOptions, 'signal'> {
  onChunk: (chunk: string) => void
  onError: (error: Error) => void
  onComplete: () => void
}

export interface FetchAPI {
  request: <T = unknown>(url: string, options?: FetchOptions) => Promise<FetchResponse<T>>
  stream: (url: string, options: StreamOptions) => Promise<void>
  m3u: (url: string, onProgress?: (progress: number) => void) => Promise<string>
}

// Dialog Types
export interface DialogOpenFileOptions {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
  properties?: Array<'openFile' | 'multiSelections'>
}

export interface DialogOpenDirectoryOptions {
  title?: string
  defaultPath?: string
  buttonLabel?: string
}

export interface DialogSaveFileOptions {
  title?: string
  defaultPath?: string
  buttonLabel?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

export interface DialogResult {
  canceled: boolean
  filePath?: string
  filePaths?: string[]
}

export interface DialogAPI {
  openFile: (options?: DialogOpenFileOptions) => Promise<DialogResult>
  openDirectory: (options?: DialogOpenDirectoryOptions) => Promise<DialogResult>
  saveFile: (options?: DialogSaveFileOptions) => Promise<DialogResult>
}

// App API
export interface AppAPI {
  getPath: (name: 'userData' | 'appData' | 'temp' | 'home') => Promise<string>
}

// Combined IPC API
export interface IPCBridge {
  fs: FileSystemAPI
  fetch: FetchAPI
  http: FetchAPI // Alias for compatibility
  dialog: DialogAPI
  app: AppAPI
}

// Error types
export class IPCError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'IPCError'
  }
}

export type IPCErrorCode =
  | 'FILE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'INVALID_PATH'
  | 'DIRECTORY_NOT_EMPTY'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN'
