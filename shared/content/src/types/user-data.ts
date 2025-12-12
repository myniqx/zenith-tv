export interface WatchProgressData {
  progress: number; // 0-1 (percentage)
  updatedAt: number; // Unix timestamp (milliseconds)
  watched: number | null; // Timestamp when marked as watched, null if not watched
}

export interface TrackSelectionData {
  audio?: number; // Audio track index
  subtitle?: number; // Subtitle track index
  updatedAt: number; // Unix timestamp (milliseconds)
}

export interface FavoriteData {
  value: boolean;
  updatedAt: number; // Unix timestamp (milliseconds)
}

export interface HiddenData {
  value: boolean;
  updatedAt: number; // Unix timestamp (milliseconds)
}

export interface UserItemData {
  favorite?: FavoriteData;
  hidden?: HiddenData;
  watchProgress?: WatchProgressData;
  tracks?: TrackSelectionData;
}
