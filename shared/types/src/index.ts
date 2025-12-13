/**
 * Shared TypeScript types for Zenith TV
 */

// M3U & Content Types
export interface M3UItem {
  title: string;
  url: string;
  group: string;
  logo?: string;
  category: Category;
  year?: number;
  season?: number;
  episode?: number;
}

export interface Episode {
  seriesName: string;
  season: number;
  episode: number;
}

export type Category =
  | { type: 'LiveStream' }
  | { type: 'Series'; episode: Episode }
  | { type: 'Movie' };

// Profile & Storage
export interface Profile {
  username: string;
  createdAt: number;
  m3uRefs: string[]; // Array of M3U UUIDs
  stickyGroups?: string[]; // Sticky group names
  hiddenGroups?: string[]; // Hidden group names
}

// Legacy profile (old system)
export interface LegacyProfile {
  id: number;
  name: string;
  m3uUrl: string;
  lastSync?: Date;
  itemCount?: number;
}

export interface WatchableItem extends M3UItem {
  profileId: number;
  addedDate: Date;
  isFavorite: boolean;
  watchHistory?: WatchHistory;
}

export interface WatchHistory {
  lastWatched: Date;
  position: number;
  duration: number;
}

// Device & Network
export interface Device {
  id: string;
  name: string;
  type: 'desktop' | 'tizen' | 'android_tv' | 'android_mobile';
  ip: string;
  port: number;
  lastSeen: Date;
  trusted: boolean;
}

export interface PairingRequest {
  deviceId: string;
  deviceName: string;
  pin: string;
}

// Player State
export interface PlayerState {
  currentItem: WatchableItem | null;
  state: 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error';
  position: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  selectedAudioTrack?: number;
  selectedSubtitleTrack?: number;
}

// WebSocket Protocol
export type WSMessage =
  | DiscoverMessage
  | PairRequestMessage
  | PairResponseMessage
  | PlayMessage
  | PauseMessage
  | SeekMessage
  | SetVolumeMessage
  | SetTrackMessage
  | StateUpdateMessage
  | SyncFavoritesMessage
  | ErrorMessage;

export interface DiscoverMessage {
  type: 'discover';
  device: Device;
}

export interface PairRequestMessage {
  type: 'pair_request';
  pairing: PairingRequest;
}

export interface PairResponseMessage {
  type: 'pair_response';
  accepted: boolean;
  deviceId: string;
}

export interface PlayMessage {
  type: 'play';
  item: WatchableItem;
  position?: number;
}

export interface PauseMessage {
  type: 'pause';
}

export interface SeekMessage {
  type: 'seek';
  position: number;
}

export interface SetVolumeMessage {
  type: 'set_volume';
  volume: number;
}

export interface SetTrackMessage {
  type: 'set_track';
  trackType: 'audio' | 'subtitle';
  trackIndex: number;
}

export interface StateUpdateMessage {
  type: 'state_update';
  state: PlayerState;
}

export interface SyncFavoritesMessage {
  type: 'sync_favorites';
  favorites: WatchableItem[];
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

// Category Tree System
export type CategoryType = 'root' | 'movies' | 'series' | 'liveStreams' | 'recent' | 'watchList' | 'watchedList';

export interface CategoryNode {
  name: string;
  type: CategoryType;
  isSticky: boolean;
  isHidden: boolean;
  itemCount: number;
  children: CategoryNode[];
}

export interface CategoryTreeItem {
  name: string;
  url: string;
  group: string;
  logo?: string;
  category: Category;
  addedDate?: number;
}

// User Data (per-user, per-M3U)
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

export interface UserData {
  [itemUrl: string]: UserItemData;
}

// Category Statistics
export interface CategoryStats {
  totalItems: number;
  movies: {
    count: number;
    groups: number;
  };
  series: {
    count: number;
    shows: number;
  };
  liveStreams: {
    count: number;
    groups: number;
  };
}

// Search Result
export interface SearchResult {
  item: CategoryTreeItem;
  category: CategoryNode;
  path: string[];
}
