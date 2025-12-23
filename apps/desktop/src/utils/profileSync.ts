import { UserData } from "@/stores/content";

/**
 * Merge two UserData objects based on timestamps
 *
 * CRITICAL: This function mutates local.watchables items to preserve object references.
 * This is necessary because WatchableObject.userData holds direct references to these objects
 * (see content.ts:263 - watchable.userData = userItemData)
 *
 * @param local - Local user data (will be mutated)
 * @param remote - Remote user data (from other device)
 * @returns Merged UserData with most recent values (local.watchables mutated in-place)
 */
export function mergeUserData(local: UserData, remote: UserData): UserData {
  // Collect all item URLs from both local and remote
  const allUrls = new Set([
    ...Object.keys(local.watchables),
    ...Object.keys(remote.watchables)
  ]);

  // Merge watchables in-place to preserve object references
  for (const url of allUrls) {
    const localItem = local.watchables[url];
    const remoteItem = remote.watchables[url];

    // If local doesn't exist, create new entry from remote
    if (!localItem) {
      local.watchables[url] = { ...remoteItem };
      continue;
    }

    // If remote doesn't exist, keep local as-is
    if (!remoteItem) {
      continue;
    }

    // Merge individual fields based on timestamps (mutate localItem in-place)

    // Favorite
    if (remoteItem.favorite) {
      const localTime = localItem.favorite?.updatedAt ?? 0;
      const remoteTime = remoteItem.favorite.updatedAt;
      if (remoteTime > localTime) {
        localItem.favorite = remoteItem.favorite;
      }
    }

    // Hidden
    if (remoteItem.hidden) {
      const localTime = localItem.hidden?.updatedAt ?? 0;
      const remoteTime = remoteItem.hidden.updatedAt;
      if (remoteTime > localTime) {
        localItem.hidden = remoteItem.hidden;
      }
    }

    // Watch progress
    if (remoteItem.watchProgress) {
      const localTime = localItem.watchProgress?.updatedAt ?? 0;
      const remoteTime = remoteItem.watchProgress.updatedAt;
      if (remoteTime > localTime) {
        localItem.watchProgress = remoteItem.watchProgress;
      }
    }

    // Tracks
    if (remoteItem.tracks) {
      const localTime = localItem.tracks?.updatedAt ?? 0;
      const remoteTime = remoteItem.tracks.updatedAt;
      if (remoteTime > localTime) {
        localItem.tracks = remoteItem.tracks;
      }
    }
  }

  // Merge arrays (union of both sets)
  const mergedHiddenGroups = [...new Set([...local.hiddenGroups, ...remote.hiddenGroups])];
  const mergedStickyGroups = [...new Set([...local.stickyGroups, ...remote.stickyGroups])];

  // Return merged data
  // Note: local.watchables already mutated in-place
  return {
    watchables: local.watchables,  // Already merged in-place
    hiddenGroups: mergedHiddenGroups,
    stickyGroups: mergedStickyGroups,
    playerData: local.playerData,    // Local preference (each device has its own)
    layoutData: local.layoutData     // Local preference (each device has its own)
  };
}
