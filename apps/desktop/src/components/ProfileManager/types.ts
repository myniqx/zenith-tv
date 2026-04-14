import type { M3UStats } from '@/stores/content';

export type SourceType = 'url' | 'file';

export interface DeleteItem {
  type: 'profile' | 'm3u';
  username?: string;
  uuid?: string;
}

export type StatsMap = Record<string, M3UStats>;
