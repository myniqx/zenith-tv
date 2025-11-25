import { GroupBy, SortBy, SortOrder } from "@/stores/content";



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

export interface LayoutData {
  /* Width of category browser */
  categoryBrowser: number
  /* Width of content browser */
  contentBrowser: number
}

export interface PlayerData {
  sortBy: SortBy
  sortOrder: SortOrder
  groupBy: GroupBy
}

export type UserData = {
  watchables: Record<string, UserItemData>;
  hiddenGroups: string[];
  stickyGroups: string[];
  playerData: PlayerData
  layoutData: LayoutData
}
