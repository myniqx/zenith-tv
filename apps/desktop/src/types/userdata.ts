


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

export type UserData = Record<string, UserItemData>;
