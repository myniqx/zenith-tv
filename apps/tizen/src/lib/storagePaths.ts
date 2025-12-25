/**
 * Storage path helpers
 * Desktop ile aynı dosya yapısı
 * Root: documents/zenith-tv/
 */

// User data paths
export const getUserDataPath = (username: string) => `userData/${username}.json`

// M3U paths
export const getM3USource = (uuid: string) => `m3u/${uuid}/source.m3u`
export const getM3UUpdate = (uuid: string) => `m3u/${uuid}/update.json`
export const getM3UStats = (uuid: string) => `m3u/${uuid}/stats.json`
export const getM3UMeta = (uuid: string) => `m3u/${uuid}/meta.json`

// User preference paths (per user, per M3U)
export const getUserPreferencePath = (username: string, uuid: string) =>
  `userPreferences/${username}/${uuid}.json`

// Settings path
export const getSettingsPath = () => `settings.json`

// Profile list path
export const getProfilesPath = () => `profiles.json`

// M3U map path (URL → UUID mapping)
export const getM3UMapPath = () => `m3uMap.json`

/**
 * Storage structure:
 *
 * documents/zenith-tv/
 * ├── profiles.json              # Profile list
 * ├── m3uMap.json                # URL → UUID mapping
 * ├── settings.json              # Global settings
 * ├── userData/
 * │   ├── user1.json             # User-specific data
 * │   └── user2.json
 * ├── m3u/
 * │   └── {uuid}/
 * │       ├── source.m3u         # Original M3U content
 * │       ├── update.json        # Last update info
 * │       ├── stats.json         # Statistics
 * │       └── meta.json          # Metadata (categories, item count)
 * └── userPreferences/
 *     └── {username}/
 *         └── {uuid}.json        # Per-user, per-M3U preferences
 *                                # (favorites, watch progress, hidden items)
 */
