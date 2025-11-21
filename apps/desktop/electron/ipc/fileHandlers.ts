import { ipcMain, IpcMainInvokeEvent } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { watch, FSWatcher } from 'fs'
import type {
  FileReadOptions,
  FileWriteOptions,
  ReadDirOptions,
  FileStats,
  IPCError
} from '../../src/types/ipc'

// Security: Validate paths to prevent directory traversal
function validatePath(filePath: string, workspaceRoot?: string): string {
  const normalized = path.normalize(filePath)

  // Prevent directory traversal
  if (normalized.includes('..')) {
    throw createIPCError(
      `Invalid path: directory traversal not allowed`,
      'INVALID_PATH',
      { inputPath: filePath, normalizedPath: normalized }
    )
  }

  // If workspace root is set, ensure path is within it
  if (workspaceRoot) {
    // If path is relative, resolve it relative to workspaceRoot
    const resolvedPath = path.isAbsolute(normalized)
      ? path.resolve(normalized)
      : path.resolve(workspaceRoot, normalized)
    const resolvedRoot = path.resolve(workspaceRoot)

    if (!resolvedPath.startsWith(resolvedRoot)) {
      throw createIPCError(
        `Path outside workspace root`,
        'PERMISSION_DENIED',
        {
          inputPath: filePath,
          normalizedPath: normalized,
          resolvedPath,
          workspaceRoot: resolvedRoot
        }
      )
    }

    // Return the resolved absolute path
    return resolvedPath
  }

  return normalized
}

function createIPCError(message: string, code: string, details?: unknown): IPCError {
  const error = new Error(message) as IPCError
  error.code = code
  error.details = details
  return error
}

// File watchers registry
const watchers = new Map<string, FSWatcher>()

export function registerFileSystemHandlers(workspaceRoot?: string): void {
  // Read file
  ipcMain.handle(
    'fs:readFile',
    async (_event: IpcMainInvokeEvent, filePath: string, options?: FileReadOptions) => {
      try {
        const validPath = validatePath(filePath, workspaceRoot)
        const encoding = options?.encoding || 'utf-8'
        const content = await fs.readFile(validPath, { encoding })
        return content
      } catch (error: unknown) {
        const ipcError = error as IPCError
        if (ipcError.code === 'PERMISSION_DENIED' || ipcError.code === 'INVALID_PATH') {
          throw error
        }
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw createIPCError('File not found', 'FILE_NOT_FOUND', {
            inputPath: filePath,
            workspaceRoot
          })
        }
        throw createIPCError(`Failed to read file: ${(error as Error).message}`, 'UNKNOWN', {
          inputPath: filePath,
          workspaceRoot,
          originalError: (error as Error).message
        })
      }
    }
  )

  // Write file
  ipcMain.handle(
    'fs:writeFile',
    async (
      _event: IpcMainInvokeEvent,
      filePath: string,
      content: string,
      options?: FileWriteOptions
    ) => {
      try {
        const validPath = validatePath(filePath, workspaceRoot)
        const encoding = options?.encoding || 'utf-8'

        // Create backup if requested
        if (options?.backup) {
          try {
            await fs.access(validPath)
            const backupPath = `${validPath}.backup`
            await fs.copyFile(validPath, backupPath)
          } catch {
            // File doesn't exist, no backup needed
          }
        }

        // Ensure directory exists
        const dir = path.dirname(validPath)
        await fs.mkdir(dir, { recursive: true })

        await fs.writeFile(validPath, content, { encoding })
      } catch (error: unknown) {
        const ipcError = error as IPCError
        if (ipcError.code === 'PERMISSION_DENIED' || ipcError.code === 'INVALID_PATH') {
          throw error
        }
        throw createIPCError(`Failed to write file: ${(error as Error).message}`, 'UNKNOWN', {
          inputPath: filePath,
          workspaceRoot,
          contentLength: content?.length,
          originalError: (error as Error).message
        })
      }
    }
  )

  // Read directory
  ipcMain.handle(
    'fs:readDir',
    async (_event: IpcMainInvokeEvent, dirPath: string, options?: ReadDirOptions) => {
      try {
        const validPath = validatePath(dirPath, workspaceRoot)

        if (options?.recursive) {
          const files: string[] = []
          async function readRecursive(currentPath: string): Promise<void> {
            const entries = await fs.readdir(currentPath, { withFileTypes: true })
            for (const entry of entries) {
              const fullPath = path.join(currentPath, entry.name)
              const relativePath = path.relative(validPath, fullPath)
              files.push(relativePath)
              if (entry.isDirectory()) {
                await readRecursive(fullPath)
              }
            }
          }
          await readRecursive(validPath)
          return files
        } else {
          return await fs.readdir(validPath)
        }
      } catch (error: unknown) {
        const ipcError = error as IPCError
        if (ipcError.code === 'PERMISSION_DENIED' || ipcError.code === 'INVALID_PATH') {
          throw error
        }
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw createIPCError('Directory not found', 'FILE_NOT_FOUND', {
            inputPath: dirPath,
            workspaceRoot
          })
        }
        throw createIPCError(`Failed to read directory: ${(error as Error).message}`, 'UNKNOWN', {
          inputPath: dirPath,
          workspaceRoot,
          originalError: (error as Error).message
        })
      }
    }
  )

  // Create directory
  ipcMain.handle(
    'fs:mkdir',
    async (_event: IpcMainInvokeEvent, dirPath: string, recursive = true) => {
      try {
        const validPath = validatePath(dirPath, workspaceRoot)
        await fs.mkdir(validPath, { recursive })
      } catch (error: unknown) {
        const ipcError = error as IPCError
        if (ipcError.code === 'PERMISSION_DENIED' || ipcError.code === 'INVALID_PATH') {
          throw error
        }
        throw createIPCError(`Failed to create directory: ${(error as Error).message}`, 'UNKNOWN', {
          inputPath: dirPath,
          workspaceRoot,
          originalError: (error as Error).message
        })
      }
    }
  )

  // Delete file or directory
  ipcMain.handle('fs:delete', async (_event: IpcMainInvokeEvent, targetPath: string) => {
    try {
      const validPath = validatePath(targetPath, workspaceRoot)
      const stats = await fs.stat(validPath)

      if (stats.isDirectory()) {
        await fs.rm(validPath, { recursive: true, force: true })
      } else {
        await fs.unlink(validPath)
      }
    } catch (error: unknown) {
      const ipcError = error as IPCError
      if (ipcError.code === 'PERMISSION_DENIED' || ipcError.code === 'INVALID_PATH') {
        throw error
      }
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw createIPCError('File or directory not found', 'FILE_NOT_FOUND', {
          inputPath: targetPath,
          workspaceRoot
        })
      }
      throw createIPCError(`Failed to delete: ${(error as Error).message}`, 'UNKNOWN', {
        inputPath: targetPath,
        workspaceRoot,
        originalError: (error as Error).message
      })
    }
  })

  // Move/rename file
  ipcMain.handle(
    'fs:move',
    async (_event: IpcMainInvokeEvent, oldPath: string, newPath: string) => {
      try {
        const validOldPath = validatePath(oldPath, workspaceRoot)
        const validNewPath = validatePath(newPath, workspaceRoot)

        // Ensure destination directory exists
        const dir = path.dirname(validNewPath)
        await fs.mkdir(dir, { recursive: true })

        await fs.rename(validOldPath, validNewPath)
      } catch (error: unknown) {
        const ipcError = error as IPCError
        if (ipcError.code === 'PERMISSION_DENIED' || ipcError.code === 'INVALID_PATH') {
          throw error
        }
        throw createIPCError(`Failed to move file: ${(error as Error).message}`, 'UNKNOWN', {
          oldPath,
          newPath,
          workspaceRoot,
          originalError: (error as Error).message
        })
      }
    }
  )

  // Check if file exists
  ipcMain.handle('fs:exists', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      const validPath = validatePath(filePath, workspaceRoot)
      await fs.access(validPath)
      return true
    } catch {
      return false
    }
  })

  // Get file stats
  ipcMain.handle('fs:stats', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      const validPath = validatePath(filePath, workspaceRoot)
      const stats = await fs.stat(validPath)

      const fileStats: FileStats = {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      }

      return fileStats
    } catch (error: unknown) {
      const ipcError = error as IPCError
      if (ipcError.code === 'PERMISSION_DENIED' || ipcError.code === 'INVALID_PATH') {
        throw error
      }
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw createIPCError('File not found', 'FILE_NOT_FOUND', {
          inputPath: filePath,
          workspaceRoot
        })
      }
      throw createIPCError(`Failed to get file stats: ${(error as Error).message}`, 'UNKNOWN', {
        inputPath: filePath,
        workspaceRoot,
        originalError: (error as Error).message
      })
    }
  })

  // Watch file or directory
  ipcMain.handle('fs:watch', async (event: IpcMainInvokeEvent, watchPath: string) => {
    try {
      const validPath = validatePath(watchPath, workspaceRoot)
      const watcherId = `${event.sender.id}-${watchPath}`

      // Remove existing watcher if any
      if (watchers.has(watcherId)) {
        watchers.get(watcherId)?.close()
        watchers.delete(watcherId)
      }

      // Create new watcher
      const watcher = watch(validPath, (eventType, filename) => {
        event.sender.send('fs:watch:change', {
          path: watchPath,
          event: eventType,
          filename: filename || ''
        })
      })

      watchers.set(watcherId, watcher)

      // Return unwatcher function identifier
      return watcherId
    } catch (error: unknown) {
      const ipcError = error as IPCError
      if (ipcError.code === 'PERMISSION_DENIED' || ipcError.code === 'INVALID_PATH') {
        throw error
      }
      throw createIPCError(`Failed to watch file: ${(error as Error).message}`, 'UNKNOWN', {
        inputPath: watchPath,
        workspaceRoot,
        originalError: (error as Error).message
      })
    }
  })

  // Unwatch
  ipcMain.handle('fs:unwatch', async (_event: IpcMainInvokeEvent, watcherId: string) => {
    if (watchers.has(watcherId)) {
      watchers.get(watcherId)?.close()
      watchers.delete(watcherId)
    }
  })
}

// Clean up watchers on app quit
export function cleanupFileWatchers(): void {
  watchers.forEach((watcher) => watcher.close())
  watchers.clear()
}
