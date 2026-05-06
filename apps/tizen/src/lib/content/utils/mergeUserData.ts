import { UserData } from '../stores/content/types';

/**
 * Merge two UserData objects using timestamps — remote wins when newer.
 * Mutates local.watchables in-place to preserve WatchableObject references.
 */
export function mergeUserData(local: UserData, remote: UserData): UserData {
  const allUrls = new Set([
    ...Object.keys(local.watchables),
    ...Object.keys(remote.watchables),
  ]);

  for (const url of allUrls) {
    const localItem = local.watchables[url];
    const remoteItem = remote.watchables[url];

    if (!localItem) {
      local.watchables[url] = { ...remoteItem };
      continue;
    }

    if (!remoteItem) continue;

    if (remoteItem.favorite) {
      const localTime = localItem.favorite?.updatedAt ?? 0;
      if (remoteItem.favorite.updatedAt > localTime) {
        localItem.favorite = remoteItem.favorite;
      }
    }

    if (remoteItem.hidden) {
      const localTime = localItem.hidden?.updatedAt ?? 0;
      if (remoteItem.hidden.updatedAt > localTime) {
        localItem.hidden = remoteItem.hidden;
      }
    }

    if (remoteItem.watchProgress) {
      const localTime = localItem.watchProgress?.updatedAt ?? 0;
      if (remoteItem.watchProgress.updatedAt > localTime) {
        localItem.watchProgress = remoteItem.watchProgress;
      }
    }

    if (remoteItem.tracks) {
      const localTime = localItem.tracks?.updatedAt ?? 0;
      if (remoteItem.tracks.updatedAt > localTime) {
        localItem.tracks = remoteItem.tracks;
      }
    }
  }

  return {
    watchables: local.watchables,
    hiddenGroups: [...new Set([...local.hiddenGroups, ...remote.hiddenGroups])],
    stickyGroups: [...new Set([...local.stickyGroups, ...remote.stickyGroups])],
    playerData: local.playerData,
    layoutData: local.layoutData,
  };
}
