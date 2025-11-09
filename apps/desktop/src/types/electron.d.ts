export interface ElectronAPI {
  platform: NodeJS.Platform;
  version: string;
  db: {
    // Profiles
    getProfiles: () => Promise<DBProfile[]>;
    addProfile: (name: string, url: string) => Promise<number>;
    deleteProfile: (id: number) => Promise<void>;

    // Items
    getItemsByProfile: (profileId: number) => Promise<DBItem[]>;
    upsertItems: (profileId: number, items: any[]) => Promise<string[]>;
    updateProfileSync: (profileId: number, count: number) => Promise<void>;

    // Recent
    getRecentItems: (profileId: number) => Promise<DBItem[]>;
    addToRecent: (itemUrls: string[]) => Promise<void>;

    // Favorites
    toggleFavorite: (itemUrl: string) => Promise<boolean>;
    getFavorites: (profileId: number) => Promise<DBItem[]>;

    // Watch History
    saveWatchProgress: (itemUrl: string, position: number, duration: number) => Promise<void>;
    getWatchHistory: (itemUrl: string) => Promise<DBWatchHistory | undefined>;

    // M3U Cache
    getM3UCache: (url: string) => Promise<DBM3UCache | null>;
    saveM3UCache: (url: string, content: string, etag?: string, lastModified?: string, expiresInHours?: number) => Promise<void>;
    invalidateM3UCache: (url: string) => Promise<void>;
    cleanExpiredCache: () => Promise<void>;
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

export interface DBProfile {
  id: number;
  name: string;
  m3u_url: string;
  last_sync: string | null;
  item_count: number;
  created_at: string;
}

export interface DBItem {
  url: string;
  title: string;
  group_name: string | null;
  logo: string | null;
  category_type: 'movie' | 'series' | 'live_stream';
  profile_id: number;
  added_date: string;

  // Series info (if applicable)
  series_name?: string;
  season?: number;
  episode?: number;

  // Favorite status
  is_favorite: number; // SQLite boolean (0 or 1)

  // Watch history (if exists)
  position?: number;
  duration?: number;
  last_watched?: string;
  completed?: number;
}

export interface DBWatchHistory {
  item_url: string;
  position: number;
  duration: number;
  last_watched: string;
  completed: number;
}

export interface DBM3UCache {
  url: string;
  content: string;
  etag?: string;
  last_modified?: string;
  cached_at: string;
  expires_at: string;
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
