export interface Profile {
  username: string
  createdAt: number
  m3uRefs: string[]
  lastLogin?: number
}

export type M3UMap = Record<string, string>

// Platform-specific filesystem abstraction
export interface ProfileFileSystem {
  exists: (path: string) => Promise<boolean>
  delete: (path: string) => Promise<void>
}

// Optional dialog dep — only desktop supports file picking
export interface ProfileDialog {
  pickM3UFile: () => Promise<string | null>
}

// HTTP dep for fetching M3U content during file import
export interface ProfileHttp {
  fetchM3U: (url: string) => Promise<string>
}

export interface ProfilesStoreDeps {
  fileSystem: ProfileFileSystem
  // Returns the currently active content store state accessors
  getContentStore: () => {
    currentUsername: string | null
    currentUUID: string | null
    reset: () => void
    setContent: (username: string, uuid: string) => Promise<void>
  } | null
  // Optional: only provided on desktop
  dialog?: ProfileDialog
  http?: ProfileHttp
  parseM3U?: (source: string) => Promise<Array<{ url: string; [key: string]: unknown }>>
}

export interface ProfilesState {
  profiles: Profile[]
  m3uMap: M3UMap

  // M3U Map helpers
  getUrlFromUUID: (uuid: string) => string | null
  getUUIDFromURL: (url: string) => string | null
  getOrCreateUUID: (url: string) => string
  removeURLMapping: (url: string) => void
  isUUIDUsed: (uuid: string) => boolean
  cleanupUnusedUUID: (uuid: string) => Promise<void>

  // Current state getters (delegated to content store)
  getCurrentUsername: () => string | null
  getCurrentUUID: () => string | null

  // Profile actions
  createProfile: (username: string) => void
  createProfileFromFile: (username: string) => Promise<{ username: string; uuid: string } | null>
  deleteProfile: (username: string) => Promise<void>
  selectProfile: (username: string, uuid?: string) => Promise<void>
  addM3UToProfile: (username: string, m3uUrl: string) => string
  removeM3UFromProfile: (username: string, uuid: string) => Promise<void>
  getProfile: (username: string) => Profile | undefined
  getAllProfiles: () => Profile[]
}
