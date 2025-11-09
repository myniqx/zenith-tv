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
}

export interface Episode {
  seriesName: string;
  season: number;
  episode: number;
}

export type Category =
  | { type: 'live_stream' }
  | { type: 'series'; episode: Episode }
  | { type: 'movie' };

// Profile & Storage
export interface Profile {
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
