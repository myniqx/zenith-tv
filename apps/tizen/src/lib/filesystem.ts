/**
 * Tizen File System wrapper
 * Desktop ile aynı API, Tizen Filesystem API ile çalışır
 * Root: documents/zenith-tv/
 */

const ROOT_DIR = 'zenith-tv'
const TIZEN_ROOT = 'documents'

export interface FileStats {
  size: number
  created: Date
  modified: Date
  isFile: boolean
  isDirectory: boolean
}

export class FileSystemError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'FileSystemError'
  }
}

// Tizen filesystem types
interface TizenFile {
  toURI(): string
  fullPath: string
  name: string
  fileSize: number
  created: Date
  modified: Date
  isFile: boolean
  isDirectory: boolean
  openStream(mode: 'r' | 'w' | 'a', onsuccess: (stream: FileStream) => void, onerror: (error: Error) => void): void
  listFiles(onsuccess: (files: TizenFile[]) => void, onerror: (error: Error) => void): void
  createFile(name: string): TizenFile
  createDirectory(name: string): TizenFile
  deleteFile(filePath: string, onsuccess: () => void, onerror: (error: Error) => void): void
  deleteDirectory(dirPath: string, recursive: boolean, onsuccess: () => void, onerror: (error: Error) => void): void
  copyTo(originFilePath: string, destinationFilePath: string, overwrite: boolean, onsuccess: () => void, onerror: (error: Error) => void): void
  moveTo(originFilePath: string, destinationFilePath: string, overwrite: boolean, onsuccess: () => void, onerror: (error: Error) => void): void
  resolve(filePath: string): TizenFile
}

interface FileStream {
  close(): void
  read(charCount: number): string
  readBytes(byteCount: number): Uint8Array
  write(data: string): void
  writeBytes(data: Uint8Array): void
  eof: boolean
  position: number
  bytesAvailable: number
}

interface TizenFilesystem {
  resolve(location: string, onsuccess: (file: TizenFile) => void, onerror: (error: Error) => void, mode?: 'r' | 'w' | 'rw'): void
  maxPathLength: number
}

declare global {
  interface Window {
    tizen?: {
      filesystem: TizenFilesystem
    }
  }
}

// Root directory Promise wrapper
let rootDirPromise: Promise<TizenFile> | null = null

async function getRootDir(): Promise<TizenFile> {
  if (rootDirPromise) return rootDirPromise

  rootDirPromise = new Promise((resolve, reject) => {
    if (!window.tizen?.filesystem) {
      reject(new FileSystemError('Tizen filesystem API not available', 'NOT_SUPPORTED'))
      return
    }

    window.tizen.filesystem.resolve(
      TIZEN_ROOT,
      (documentsDir) => {
        try {
          // Check if zenith-tv directory exists
          let zenithDir: TizenFile
          try {
            zenithDir = documentsDir.resolve(ROOT_DIR)
          } catch {
            // Create if not exists
            zenithDir = documentsDir.createDirectory(ROOT_DIR)
          }
          resolve(zenithDir)
        } catch (error) {
          reject(new FileSystemError('Failed to create root directory', 'INIT_ERROR', error))
        }
      },
      (error) => {
        reject(new FileSystemError('Failed to resolve documents directory', 'RESOLVE_ERROR', error))
      },
      'rw'
    )
  })

  return rootDirPromise
}

// Path utilities
function normalizePath(path: string): string {
  // Remove leading/trailing slashes
  return path.replace(/^\/+|\/+$/g, '')
}

function getParentPath(path: string): string {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/')
}

function getFileName(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1]
}

async function ensureDirectoryExists(path: string): Promise<void> {
  const root = await getRootDir()
  const parts = normalizePath(path).split('/')

  let current = root
  for (const part of parts) {
    if (!part) continue

    try {
      current = current.resolve(part)
    } catch {
      // Directory doesn't exist, create it
      current = current.createDirectory(part)
    }
  }
}

async function resolveFile(path: string, createIfNotExists = false): Promise<TizenFile> {
  const root = await getRootDir()
  const normalized = normalizePath(path)

  if (!normalized) return root

  const parts = normalized.split('/')
  let current = root

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const isLast = i === parts.length - 1

    try {
      current = current.resolve(part)
    } catch {
      if (createIfNotExists && isLast) {
        // Create file
        return current.createFile(part)
      } else if (createIfNotExists && !isLast) {
        // Create directory
        current = current.createDirectory(part)
      } else {
        throw new FileSystemError(`Path not found: ${path}`, 'FILE_NOT_FOUND')
      }
    }
  }

  return current
}

/**
 * Type-safe file system utilities for Tizen
 * API compatible with Desktop version
 */
export const fileSystem = {
  /**
   * Read file content as string
   */
  async readFile(path: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const file = await resolveFile(path)

        if (!file.isFile) {
          throw new FileSystemError(`Not a file: ${path}`, 'NOT_A_FILE')
        }

        file.openStream(
          'r',
          (stream) => {
            try {
              const content = stream.read(file.fileSize)
              stream.close()
              resolve(content)
            } catch (error) {
              stream.close()
              reject(new FileSystemError('Failed to read file', 'READ_ERROR', error))
            }
          },
          (error) => {
            reject(new FileSystemError('Failed to open file', 'OPEN_ERROR', error))
          }
        )
      } catch (error) {
        reject(error)
      }
    })
  },

  /**
   * Read and parse JSON file
   */
  async readJSON<T = unknown>(path: string): Promise<T> {
    const content = await fileSystem.readFile(path)
    return JSON.parse(content) as T
  },

  /**
   * Write string content to file
   */
  async writeFile(path: string, content: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Ensure parent directory exists
        const parentPath = getParentPath(path)
        if (parentPath) {
          await ensureDirectoryExists(parentPath)
        }

        const file = await resolveFile(path, true)

        file.openStream(
          'w',
          (stream) => {
            try {
              stream.write(content)
              stream.close()
              resolve()
            } catch (error) {
              stream.close()
              reject(new FileSystemError('Failed to write file', 'WRITE_ERROR', error))
            }
          },
          (error) => {
            reject(new FileSystemError('Failed to open file for writing', 'OPEN_ERROR', error))
          }
        )
      } catch (error) {
        reject(error)
      }
    })
  },

  /**
   * Write JSON data to file (pretty-printed)
   */
  async writeJSON<T>(path: string, data: T): Promise<void> {
    const content = JSON.stringify(data, null, 2)
    return fileSystem.writeFile(path, content)
  },

  /**
   * Read directory contents
   */
  async readDir(path: string): Promise<string[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const dir = await resolveFile(path)

        if (!dir.isDirectory) {
          throw new FileSystemError(`Not a directory: ${path}`, 'NOT_A_DIRECTORY')
        }

        dir.listFiles(
          (files) => {
            const names = files.map(f => f.name)
            resolve(names)
          },
          (error) => {
            reject(new FileSystemError('Failed to list directory', 'LIST_ERROR', error))
          }
        )
      } catch (error) {
        reject(error)
      }
    })
  },

  /**
   * Create directory (recursive by default)
   */
  async mkdir(path: string, recursive = true): Promise<void> {
    if (recursive) {
      await ensureDirectoryExists(path)
    } else {
      const root = await getRootDir()
      const normalized = normalizePath(path)
      const parentPath = getParentPath(normalized)
      const dirName = getFileName(normalized)

      let parent = root
      if (parentPath) {
        parent = await resolveFile(parentPath)
      }

      parent.createDirectory(dirName)
    }
  },

  /**
   * Delete file or directory
   */
  async delete(path: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const file = await resolveFile(path)
        const parent = await resolveFile(getParentPath(path) || '.')

        if (file.isDirectory) {
          parent.deleteDirectory(
            file.name,
            true,
            () => resolve(),
            (error) => reject(new FileSystemError('Failed to delete directory', 'DELETE_ERROR', error))
          )
        } else {
          parent.deleteFile(
            file.name,
            () => resolve(),
            (error) => reject(new FileSystemError('Failed to delete file', 'DELETE_ERROR', error))
          )
        }
      } catch (error) {
        reject(error)
      }
    })
  },

  /**
   * Move/rename file or directory
   */
  async move(oldPath: string, newPath: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Ensure destination parent exists
        const newParentPath = getParentPath(newPath)
        if (newParentPath) {
          await ensureDirectoryExists(newParentPath)
        }

        const root = await getRootDir()
        const normalizedOld = normalizePath(oldPath)
        const normalizedNew = normalizePath(newPath)

        root.moveTo(
          normalizedOld,
          normalizedNew,
          true,
          () => resolve(),
          (error) => reject(new FileSystemError('Failed to move file', 'MOVE_ERROR', error))
        )
      } catch (error) {
        reject(error)
      }
    })
  },

  /**
   * Copy file to destination
   */
  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Ensure destination parent exists
        const destParentPath = getParentPath(destPath)
        if (destParentPath) {
          await ensureDirectoryExists(destParentPath)
        }

        const root = await getRootDir()
        const normalizedSource = normalizePath(sourcePath)
        const normalizedDest = normalizePath(destPath)

        root.copyTo(
          normalizedSource,
          normalizedDest,
          true,
          () => resolve(),
          (error) => reject(new FileSystemError('Failed to copy file', 'COPY_ERROR', error))
        )
      } catch (error) {
        reject(error)
      }
    })
  },

  /**
   * Check if file or directory exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      await resolveFile(path)
      return true
    } catch {
      return false
    }
  },

  /**
   * Get file/directory statistics
   */
  async stats(path: string): Promise<FileStats> {
    const file = await resolveFile(path)

    return {
      size: file.fileSize,
      created: file.created,
      modified: file.modified,
      isFile: file.isFile,
      isDirectory: file.isDirectory
    }
  },

  /**
   * Read JSON file with fallback to default value if not exists
   */
  async readJSONOrDefault<T>(path: string, defaultValue: T): Promise<T> {
    try {
      const exists = await fileSystem.exists(path)
      if (!exists) {
        return defaultValue
      }
      return await fileSystem.readJSON<T>(path)
    } catch (error) {
      console.warn(`[FileSystem] Failed to read ${path}, using default:`, error)
      return defaultValue
    }
  },

  /**
   * Ensure file exists, create with default data if not
   */
  async ensureFile<T>(path: string, defaultData: T): Promise<T> {
    try {
      const exists = await fileSystem.exists(path)
      if (!exists) {
        await fileSystem.writeJSON(path, defaultData)
        return defaultData
      }
      return await fileSystem.readJSON<T>(path)
    } catch (error) {
      console.warn(`[FileSystem] Failed to ensure ${path}, using default:`, error)
      return defaultData
    }
  },

  /**
   * Update JSON file with partial data (merge)
   */
  async updateJSON<T extends Record<string, unknown>>(
    path: string,
    updater: (data: T) => T | Partial<T>
  ): Promise<T> {
    const current = await fileSystem.readJSON<T>(path)
    const updated = updater(current)
    const merged = { ...current, ...updated } as T
    await fileSystem.writeJSON(path, merged)
    return merged
  },

  /**
   * Check if path is a file
   */
  async isFile(path: string): Promise<boolean> {
    try {
      const stats = await fileSystem.stats(path)
      return stats.isFile
    } catch {
      return false
    }
  },

  /**
   * Check if path is a directory
   */
  async isDirectory(path: string): Promise<boolean> {
    try {
      const stats = await fileSystem.stats(path)
      return stats.isDirectory
    } catch {
      return false
    }
  },

  /**
   * Get file size in bytes
   */
  async getSize(path: string): Promise<number> {
    const stats = await fileSystem.stats(path)
    return stats.size
  },

  /**
   * Get file modification time
   */
  async getModifiedTime(path: string): Promise<Date> {
    const stats = await fileSystem.stats(path)
    return stats.modified
  },

  /**
   * Delete file if exists (no error if not exists)
   */
  async deleteIfExists(path: string): Promise<boolean> {
    try {
      const exists = await fileSystem.exists(path)
      if (exists) {
        await fileSystem.delete(path)
        return true
      }
      return false
    } catch (error) {
      console.warn(`[FileSystem] Failed to delete ${path}:`, error)
      return false
    }
  },
} as const

/**
 * Type-safe error handler for file operations
 */
export function handleFileError(error: unknown, fallback?: string): FileSystemError {
  if (error instanceof FileSystemError) {
    return error
  }
  return new FileSystemError(
    fallback || 'Unknown file system error',
    'UNKNOWN',
    error
  )
}
