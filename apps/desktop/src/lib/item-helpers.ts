/**
 * Item Helper Functions
 * Utilities for merging M3U items with user data and converting formats
 */

import type { WatchableItem } from '@zenith-tv/types';
import type { ParsedM3UItem } from '@zenith-tv/parser';
import type { UserItemData } from '../services/user-data-service';

/**
 * Merge M3U parsed item with user data to create WatchableItem
 */
export function mergeItemWithUserData(
  item: ParsedM3UItem,
  userData: UserItemData | null | undefined
): WatchableItem {
  return {
    title: item.title,
    url: item.url,
    group: item.group,
    logo: item.logo,
    category: item.category,
    profileId: 0, // Deprecated field, kept for compatibility
    addedDate: new Date(), // We don't track this anymore
    isFavorite: userData?.favorite ?? false,
    watchHistory: userData?.watchProgress
      ? {
          lastWatched: userData.lastWatchedAt ? new Date(userData.lastWatchedAt) : new Date(),
          position: userData.watchProgress, // Stored as percentage now
          duration: 100, // Always 100 for percentage-based progress
        }
      : undefined,
  };
}

/**
 * Merge array of items with user data map
 */
export function mergeItemsWithUserData(
  items: ParsedM3UItem[],
  userDataMap: Record<string, UserItemData>
): WatchableItem[] {
  return items.map((item) => mergeItemWithUserData(item, userDataMap[item.url]));
}

/**
 * Convert seconds and duration to progress percentage (0-100)
 */
export function secondsToProgress(position: number, duration: number): number {
  if (duration === 0) return 0;
  const progress = (position / duration) * 100;
  return Math.min(100, Math.max(0, progress)); // Clamp between 0-100
}

/**
 * Convert progress percentage (0-100) to seconds based on duration
 */
export function progressToSeconds(progress: number, duration: number): number {
  return (progress / 100) * duration;
}

/**
 * Check if an item should be considered "watched" (>90% progress)
 */
export function isWatched(progress: number): boolean {
  return progress >= 90;
}

/**
 * Format progress as human-readable string
 */
export function formatProgress(progress: number): string {
  return `${Math.round(progress)}%`;
}

/**
 * Filter items by category type
 */
export function filterByCategory(
  items: WatchableItem[],
  category: 'all' | 'movies' | 'series' | 'live'
): WatchableItem[] {
  if (category === 'all') return items;

  const typeMap = {
    movies: 'movie',
    series: 'series',
    live: 'live_stream',
  };

  return items.filter((item) => item.category.type === typeMap[category]);
}

/**
 * Filter favorites from items
 */
export function filterFavorites(items: WatchableItem[]): WatchableItem[] {
  return items.filter((item) => item.isFavorite);
}

/**
 * Filter recently watched items (have watch history)
 */
export function filterRecentlyWatched(items: WatchableItem[]): WatchableItem[] {
  return items
    .filter((item) => item.watchHistory)
    .sort((a, b) => {
      const aTime = a.watchHistory?.lastWatched.getTime() ?? 0;
      const bTime = b.watchHistory?.lastWatched.getTime() ?? 0;
      return bTime - aTime; // Most recent first
    });
}

/**
 * Sort items by name
 */
export function sortByName(items: WatchableItem[], order: 'asc' | 'desc' = 'asc'): WatchableItem[] {
  return [...items].sort((a, b) => {
    const comparison = a.title.localeCompare(b.title);
    return order === 'asc' ? comparison : -comparison;
  });
}

/**
 * Sort items by date added
 */
export function sortByDate(items: WatchableItem[], order: 'asc' | 'desc' = 'asc'): WatchableItem[] {
  return [...items].sort((a, b) => {
    const comparison = a.addedDate.getTime() - b.addedDate.getTime();
    return order === 'asc' ? comparison : -comparison;
  });
}

/**
 * Sort items by recently watched
 */
export function sortByRecentlyWatched(items: WatchableItem[]): WatchableItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.watchHistory?.lastWatched.getTime() ?? 0;
    const bTime = b.watchHistory?.lastWatched.getTime() ?? 0;

    if (aTime && bTime) {
      return bTime - aTime; // Most recent first
    } else if (aTime) {
      return -1; // Items with history come first
    } else if (bTime) {
      return 1;
    }

    return 0;
  });
}

/**
 * Search items by title or group
 */
export function searchItems(items: WatchableItem[], query: string): WatchableItem[] {
  if (!query.trim()) return items;

  const lowerQuery = query.toLowerCase();
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(lowerQuery) ||
      item.group?.toLowerCase().includes(lowerQuery)
  );
}
