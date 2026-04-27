/**
 * Mock Tizen Filesystem for browser testing
 * Uses localStorage to simulate file operations
 */

const MOCK_STORAGE_PREFIX = '__tizen_fs__'

interface MockFile {
  name: string
  path: string
  isFile: boolean
  isDirectory: boolean
  content?: string
  children?: Record<string, MockFile>
  fileSize: number
  created: Date
  modified: Date
}

class MockFileSystem {
  private storage: Record<string, MockFile> = {}

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem(MOCK_STORAGE_PREFIX + 'root')
      if (data) {
        this.storage = JSON.parse(data, (key, value) => {
          if (key === 'created' || key === 'modified') {
            return new Date(value)
          }
          return value
        })
      } else {
        this.storage = this.createRootStructure()
        this.saveToStorage()
      }
    } catch {
      this.storage = this.createRootStructure()
      this.saveToStorage()
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(MOCK_STORAGE_PREFIX + 'root', JSON.stringify(this.storage))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('[MockFS] localStorage quota exceeded - large M3U files need IndexedDB. Data will persist in memory only for this session.')
      } else {
        console.warn('[MockFS] Failed to save to localStorage:', error)
      }
    }
  }

  private createRootStructure(): Record<string, MockFile> {
    return {
      documents: {
        name: 'documents',
        path: 'documents',
        isFile: false,
        isDirectory: true,
        children: {},
        fileSize: 0,
        created: new Date(),
        modified: new Date(),
      }
    }
  }

  private resolvePath(location: string): MockFile | null {
    const parts = location.split('/').filter(p => p)
    let current: MockFile | undefined = this.storage[parts[0]]

    for (let i = 1; i < parts.length; i++) {
      if (!current || !current.children) return null
      current = current.children[parts[i]]
    }

    return current || null
  }

  resolve(
    location: string,
    onsuccess: (file: any) => void,
    onerror: (error: Error) => void,
    mode?: 'r' | 'w' | 'rw'
  ) {
    const file = this.resolvePath(location)
    if (!file) {
      onerror(new Error(`Path not found: ${location}`))
      return
    }
    onsuccess(this.createFileHandle(file, location))
  }

  private createFileHandle(mockFile: MockFile, fullPath: string) {
    const self = this
    return {
      toURI: () => `file://${fullPath}`,
      fullPath,
      name: mockFile.name,
      fileSize: mockFile.fileSize,
      created: mockFile.created,
      modified: mockFile.modified,
      isFile: mockFile.isFile,
      isDirectory: mockFile.isDirectory,

      openStream(
        mode: 'r' | 'w' | 'a',
        onsuccess: (stream: any) => void,
        onerror: (error: Error) => void
      ) {
        if (!mockFile.isFile) {
          onerror(new Error('Not a file'))
          return
        }

        const stream = {
          close: () => {
            if (mode === 'w' || mode === 'a') {
              self.saveToStorage()
            }
          },
          read: (charCount: number) => {
            return mockFile.content || ''
          },
          readBytes: (byteCount: number) => {
            return new Uint8Array()
          },
          write: (data: string) => {
            mockFile.content = data
            mockFile.fileSize = new Blob([data]).size
            mockFile.modified = new Date()
          },
          writeBytes: (data: Uint8Array) => {
            mockFile.content = new TextDecoder().decode(data)
            mockFile.fileSize = data.length
            mockFile.modified = new Date()
          },
          eof: false,
          position: 0,
          bytesAvailable: mockFile.fileSize,
        }

        onsuccess(stream)
      },

      listFiles(
        onsuccess: (files: any[]) => void,
        onerror: (error: Error) => void
      ) {
        if (!mockFile.isDirectory || !mockFile.children) {
          onerror(new Error('Not a directory'))
          return
        }

        const files = Object.values(mockFile.children).map(child =>
          self.createFileHandle(child, `${fullPath}/${child.name}`)
        )
        onsuccess(files)
      },

      createFile(name: string) {
        if (!mockFile.isDirectory || !mockFile.children) {
          throw new Error('Not a directory')
        }

        const newFile: MockFile = {
          name,
          path: `${fullPath}/${name}`,
          isFile: true,
          isDirectory: false,
          content: '',
          fileSize: 0,
          created: new Date(),
          modified: new Date(),
        }

        mockFile.children[name] = newFile
        self.saveToStorage()
        return self.createFileHandle(newFile, newFile.path)
      },

      createDirectory(name: string) {
        if (!mockFile.isDirectory || !mockFile.children) {
          throw new Error('Not a directory')
        }

        const newDir: MockFile = {
          name,
          path: `${fullPath}/${name}`,
          isFile: false,
          isDirectory: true,
          children: {},
          fileSize: 0,
          created: new Date(),
          modified: new Date(),
        }

        mockFile.children[name] = newDir
        self.saveToStorage()
        return self.createFileHandle(newDir, newDir.path)
      },

      deleteFile(
        filePath: string,
        onsuccess: () => void,
        onerror: (error: Error) => void
      ) {
        if (!mockFile.children) {
          onerror(new Error('Not a directory'))
          return
        }

        delete mockFile.children[filePath]
        self.saveToStorage()
        onsuccess()
      },

      deleteDirectory(
        dirPath: string,
        recursive: boolean,
        onsuccess: () => void,
        onerror: (error: Error) => void
      ) {
        if (!mockFile.children) {
          onerror(new Error('Not a directory'))
          return
        }

        delete mockFile.children[dirPath]
        self.saveToStorage()
        onsuccess()
      },

      copyTo(
        originFilePath: string,
        destinationFilePath: string,
        overwrite: boolean,
        onsuccess: () => void,
        onerror: (error: Error) => void
      ) {
        onsuccess()
      },

      moveTo(
        originFilePath: string,
        destinationFilePath: string,
        overwrite: boolean,
        onsuccess: () => void,
        onerror: (error: Error) => void
      ) {
        onsuccess()
      },

      resolve(filePath: string) {
        if (!mockFile.children) {
          throw new Error('Not a directory')
        }

        const child = mockFile.children[filePath]
        if (!child) {
          throw new Error(`Path not found: ${filePath}`)
        }

        return self.createFileHandle(child, `${fullPath}/${filePath}`)
      },
    }
  }

  get maxPathLength() {
    return 256
  }
}

// Create mock Tizen API
export function initMockTizen() {
  if (typeof window !== 'undefined' && !window.tizen) {
    console.log('[MockFS] Initializing mock Tizen filesystem for browser testing')

    const mockFS = new MockFileSystem()

    ;(window as any).tizen = {
      filesystem: mockFS
    }
  }
}
