import '../models/index.dart';
import '../utils/string_matcher.dart';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const List<String> kAlphabeticGroups = [
  'A', 'B', 'C', 'Ç', 'D', 'E', 'F', 'G', 'Ğ', 'H', 'I', 'İ', 'J', 'K', 'L',
  'M', 'N', 'O', 'Ö', 'P', 'R', 'S', 'Ş', 'T', 'U', 'Ü', 'V', 'Y', 'Z', '#',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

enum SortBy { name, date, recent }
enum SortOrder { asc, desc }
enum GroupBy { none, group, year, alphabetic }

class ContentGroupData {
  final String title;
  final List<ViewObject> items; // GroupObject or WatchableObject
  final bool isGroups; // true = GroupObject list, false = WatchableObject list

  const ContentGroupData({
    required this.title,
    required this.items,
    required this.isGroups,
  });
}

class M3UUpdateData {
  final Map<String, int> items; // url → addedAt timestamp (ms)
  final int createdAt;
  final int updatedAt;

  const M3UUpdateData({
    required this.items,
    required this.createdAt,
    required this.updatedAt,
  });

  factory M3UUpdateData.fresh() {
    final now = DateTime.now().millisecondsSinceEpoch;
    return M3UUpdateData(items: {}, createdAt: now, updatedAt: now);
  }

  factory M3UUpdateData.fromJson(Map<String, dynamic> json) => M3UUpdateData(
        items: (json['items'] as Map<String, dynamic>? ?? {}).map(
          (k, v) => MapEntry(k, (v as num).toInt()),
        ),
        createdAt: (json['createdAt'] as num).toInt(),
        updatedAt: (json['updatedAt'] as num).toInt(),
      );

  Map<String, dynamic> toJson() => {
        'items': items,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };
}

class M3UStats {
  final int groupCount;
  final int tvShowCount;
  final int tvShowEpisodeCount;
  final int liveStreamCount;
  final int movieCount;
  final int totalWatchables;

  const M3UStats({
    required this.groupCount,
    required this.tvShowCount,
    required this.tvShowEpisodeCount,
    required this.liveStreamCount,
    required this.movieCount,
    required this.totalWatchables,
  });

  Map<String, dynamic> toJson() => {
        'groupCount': groupCount,
        'tvShowCount': tvShowCount,
        'tvShowEpisodeCount': tvShowEpisodeCount,
        'liveStreamCount': liveStreamCount,
        'movieCount': movieCount,
        'totalWatchables': totalWatchables,
      };
}

class PlayerData {
  final SortBy sortBy;
  final SortOrder sortOrder;
  final GroupBy groupBy;

  const PlayerData({
    this.sortBy = SortBy.name,
    this.sortOrder = SortOrder.asc,
    this.groupBy = GroupBy.none,
  });

  factory PlayerData.fromJson(Map<String, dynamic> json) => PlayerData(
        sortBy: _parseSortBy(json['sortBy'] as String? ?? 'name'),
        sortOrder: _parseSortOrder(json['sortOrder'] as String? ?? 'asc'),
        groupBy: _parseGroupBy(json['groupBy'] as String? ?? 'none'),
      );

  Map<String, dynamic> toJson() => {
        'sortBy': sortBy.name,
        'sortOrder': sortOrder.name,
        'groupBy': groupBy.name,
      };

  static SortBy _parseSortBy(String v) =>
      SortBy.values.firstWhere((e) => e.name == v, orElse: () => SortBy.name);
  static SortOrder _parseSortOrder(String v) =>
      SortOrder.values.firstWhere((e) => e.name == v, orElse: () => SortOrder.asc);
  static GroupBy _parseGroupBy(String v) =>
      GroupBy.values.firstWhere((e) => e.name == v, orElse: () => GroupBy.none);
}

class UserData {
  final Map<String, UserItemData> watchables;
  final List<String> hiddenGroups;
  final List<String> stickyGroups;
  final PlayerData playerData;

  const UserData({
    this.watchables = const {},
    this.hiddenGroups = const [],
    this.stickyGroups = const [],
    this.playerData = const PlayerData(),
  });

  static const empty = UserData();

  factory UserData.fromJson(Map<String, dynamic> json) => UserData(
        watchables: (json['watchables'] as Map<String, dynamic>? ?? {}).map(
          (k, v) => MapEntry(k, UserItemData.fromJson(v as Map<String, dynamic>)),
        ),
        hiddenGroups: List<String>.from(json['hiddenGroups'] as List? ?? []),
        stickyGroups: List<String>.from(json['stickyGroups'] as List? ?? []),
        playerData: json['playerData'] != null
            ? PlayerData.fromJson(json['playerData'] as Map<String, dynamic>)
            : const PlayerData(),
      );

  Map<String, dynamic> toJson() => {
        'watchables': watchables.map((k, v) => MapEntry(k, v.toJson())),
        'hiddenGroups': hiddenGroups,
        'stickyGroups': stickyGroups,
        'playerData': playerData.toJson(),
      };

  UserData copyWith({
    Map<String, UserItemData>? watchables,
    List<String>? hiddenGroups,
    List<String>? stickyGroups,
    PlayerData? playerData,
  }) =>
      UserData(
        watchables: watchables ?? this.watchables,
        hiddenGroups: hiddenGroups ?? this.hiddenGroups,
        stickyGroups: stickyGroups ?? this.stickyGroups,
        playerData: playerData ?? this.playerData,
      );
}

// ---------------------------------------------------------------------------
// File path helpers — mirrors shared/content/src/stores/content/helpers.ts
// ---------------------------------------------------------------------------

String getUserDataPath(String username) => 'userData/$username.json';
String getM3USource(String uuid) => 'm3u/$uuid/source.m3u';
String getM3UUpdate(String uuid) => 'm3u/$uuid/update.json';
String getM3UStats(String uuid) => 'm3u/$uuid/stats.json';

// ---------------------------------------------------------------------------
// Sort / filter helpers
// ---------------------------------------------------------------------------

double secondsToProgress(double position, double duration) {
  if (duration <= 0) return 0;
  return position / duration;
}

List<T> sortItems<T extends ViewObject>(
    List<T> items, SortBy sortBy, SortOrder sortOrder) {
  final sorted = [...items];
  sorted.sort((a, b) {
    int cmp;
    if (a is WatchableObject && b is WatchableObject) {
      switch (sortBy) {
        case SortBy.name:
          cmp = a.name.compareTo(b.name);
          break;
        case SortBy.date:
          final aDate = a.addedDate?.millisecondsSinceEpoch ?? 0;
          final bDate = b.addedDate?.millisecondsSinceEpoch ?? 0;
          cmp = aDate.compareTo(bDate);
          break;
        case SortBy.recent:
          final aW = a.userData.watchProgress?.updatedAt ?? 0;
          final bW = b.userData.watchProgress?.updatedAt ?? 0;
          cmp = bW.compareTo(aW);
          break;
      }
    } else {
      cmp = a.name.compareTo(b.name);
    }
    return sortOrder == SortOrder.asc ? cmp : -cmp;
  });
  return sorted;
}

List<WatchableObject> filterBySearch(
    List<WatchableObject> items, String query) {
  if (query.trim().isEmpty) return items;
  final parts = query.toLowerCase().trim().split(RegExp(r'\s+'));
  return items.where((w) => StringMatcher.hasMatch(parts, w.name)).toList();
}

String getFirstLetter(String name) {
  if (name.isEmpty) return '#';
  // Use runes to correctly handle multi-byte chars (e.g. Turkish Ç, Ş)
  final first = String.fromCharCode(name.runes.first).toUpperCase();
  return kAlphabeticGroups.contains(first) ? first : '#';
}

List<GroupObject> collectGroupsRecursive(GroupObject group) {
  final result = <GroupObject>[...group.groups];
  for (final g in group.groups) {
    result.addAll(collectGroupsRecursive(g));
  }
  return result;
}

List<WatchableObject> collectWatchablesRecursive(GroupObject group) {
  final result = <WatchableObject>[...group.watchables];
  for (final g in group.groups) {
    result.addAll(collectWatchablesRecursive(g));
  }
  return result;
}
