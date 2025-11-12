export interface ElectronAPI {
  platform: NodeJS.Platform;
  version: string;

  // Profile Management API
  profile: {
    getAll: () => Promise<ProfileData[]>;
    get: (username: string) => Promise<ProfileData | null>;
    create: (username: string) => Promise<ProfileData>;
    delete: (username: string) => Promise<void>;
    hasProfile: (username: string) => Promise<boolean>;
  };

  // M3U Management API
  m3u: {
    addToProfile: (username: string, m3uUrl: string) => Promise<M3UAddResult>;
    removeFromProfile: (username: string, uuid: string) => Promise<void>;
    getProfileM3Us: (username: string) => Promise<M3USource[]>;
    fetchAndCache: (uuid: string, m3uUrl: string) => Promise<string>;
    update: (uuid: string, m3uUrl: string, parseFunction: (content: string) => Promise<M3UParsedItem[]>) => Promise<M3UUpdateResult>;
    loadSource: (uuid: string) => Promise<string | null>;
    getRecentItems: (username: string, daysToKeep?: number) => Promise<RecentItem[]>;
    getOutdated: (username: string, maxAgeHours?: number) => Promise<OutdatedM3U[]>;
    getStats: (username: string) => Promise<M3UStats>;
    onFetchProgress: (callback: (data: { uuid: string; progress: number }) => void) => void;
    onUpdateProgress: (callback: (data: { uuid: string; progress: number }) => void) => void;
  };

  // User Data API (per-user, per-M3U)
  userData: {
    get: (username: string, uuid: string) => Promise<UserData>;
    getItem: (username: string, uuid: string, itemUrl: string) => Promise<UserItemData | null>;
    updateItem: (username: string, uuid: string, itemUrl: string, updates: Partial<UserItemData>) => Promise<UserItemData>;
    deleteItem: (username: string, uuid: string, itemUrl: string) => Promise<void>;

    toggleFavorite: (username: string, uuid: string, itemUrl: string) => Promise<boolean>;
    toggleHidden: (username: string, uuid: string, itemUrl: string) => Promise<boolean>;
    updateWatchProgress: (username: string, uuid: string, itemUrl: string, progress: number) => Promise<UserItemData>;
    markAsWatched: (username: string, uuid: string, itemUrl: string) => Promise<UserItemData>;
    saveTracks: (username: string, uuid: string, itemUrl: string, audioTrack?: number, subtitleTrack?: number) => Promise<UserItemData>;

    getAllFavorites: (username: string, uuids: string[]) => Promise<FavoriteItem[]>;
    getAllRecentlyWatched: (username: string, uuids: string[], limit?: number) => Promise<RecentlyWatchedItem[]>;
    getStats: (username: string, uuid: string) => Promise<UserDataStats>;
    getCombinedStats: (username: string, uuids: string[]) => Promise<UserDataStats>;

    clearOldHistory: (username: string, uuid: string, daysToKeep?: number) => Promise<number>;
    deleteAll: (username: string, uuid: string) => Promise<void>;
    deleteAllForUser: (username: string) => Promise<void>;
    clearCache: (username?: string, uuid?: string) => void;
  };

  // Category Management API
  category: {
    getTree: (uuid: string, username: string) => Promise<CategoryTree | null>;
    toggleSticky: (username: string, groupName: string) => Promise<boolean>;
    toggleHidden: (username: string, groupName: string) => Promise<boolean>;
    getStickyGroups: (username: string) => Promise<string[]>;
    getHiddenGroups: (username: string) => Promise<string[]>;
  };
  p2p: {
    // Server control
    start: (port: number) => Promise<P2PDeviceInfo>;
    stop: () => Promise<void>;
    getDeviceInfo: () => Promise<P2PDeviceInfo>;

    // Pairing
    acceptPairing: (deviceId: string, pin: string) => Promise<boolean>;
    rejectPairing: (deviceId: string) => Promise<void>;

    // State broadcast
    broadcastState: (state: P2PPlayerState) => Promise<void>;

    // Event listeners
    onPairingRequest: (callback: (request: P2PPairingRequest) => void) => void;
    onPlay: (callback: (data: { item: any; position?: number }) => void) => void;
    onPause: (callback: () => void) => void;
    onSeek: (callback: (position: number) => void) => void;
    onSetVolume: (callback: (volume: number) => void) => void;
  };
  file: {
    selectM3U: () => Promise<M3UFileResult | null>;
  };
}

// Profile Data
export interface ProfileData {
  username: string;
  createdAt: number;
  m3uRefs: string[];
  stickyGroups?: string[];
  hiddenGroups?: string[];
}

// M3U Types
export interface M3UAddResult {
  uuid: string;
  isNew: boolean;
  hasCache: boolean;
}

export interface M3USource {
  uuid: string;
  url: string;
  hasSource: boolean;
  stats: M3UStats | null;
}

export interface M3UParsedItem {
  name: string;
  url: string;
  group: string;
  logo?: string;
  category: string;
  episode?: {
    seriesName: string;
    season: number;
    episode: number;
  };
  addedDate?: number;
}

export interface M3UUpdateResult {
  diff: {
    added: M3UParsedItem[];
    removed: M3UParsedItem[];
    unchanged: M3UParsedItem[];
  };
  stats: M3UStats;
  parsedItems: M3UParsedItem[];
  categoryTree: CategoryTree;
}

export interface M3UStats {
  totalItems: number;
  movies: number;
  series: number;
  liveStreams: number;
  seasons: number;
  episodes: number;
  groups: Record<string, number>;
  categories: Record<string, number>;
  lastUpdated?: number;
}

export interface RecentItem {
  url: string;
  name: string;
  group: string;
  addedAt: number;
  sourceUUID: string;
}

export interface OutdatedM3U {
  uuid: string;
  url: string;
  lastUpdated?: number;
}

// User Data Types
export interface UserData {
  [itemUrl: string]: UserItemData;
}

export interface UserItemData {
  favorite?: boolean;
  hidden?: boolean;
  watchProgress?: number;
  lastWatchedAt?: number;
  watched?: boolean;
  watchedAt?: number;
  audioTrack?: number;
  subtitleTrack?: number;
}

export interface FavoriteItem {
  url: string;
  favorite: boolean;
  sourceUUID: string;
  [key: string]: unknown;
}

export interface RecentlyWatchedItem {
  url: string;
  lastWatchedAt: number;
  watchProgress?: number;
  sourceUUID: string;
  [key: string]: unknown;
}

export interface UserDataStats {
  totalTracked: number;
  favorites: number;
  hidden: number;
  watched: number;
  inProgress: number;
}

// Category Tree Types
export interface CategoryTree {
  name: string;
  type: 'root' | 'movies' | 'series' | 'liveStreams';
  children: CategoryNode[];
  items: M3UParsedItem[];
  isSticky: boolean;
  isHidden: boolean;
}

export interface CategoryNode {
  name: string;
  type: string;
  children: CategoryNode[];
  items: M3UParsedItem[];
  isSticky: boolean;
  isHidden: boolean;
}

export interface P2PDeviceInfo {
  deviceId: string;
  deviceName: string;
  port: number;
}

export interface P2PPairingRequest {
  deviceId: string;
  deviceName: string;
  pin: string;
}

export interface P2PPlayerState {
  currentItem: any;
  state: 'playing' | 'paused' | 'idle';
  position: number;
  volume: number;
}

export interface M3UFileResult {
  path: string;
  content: string;
  name: string;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
