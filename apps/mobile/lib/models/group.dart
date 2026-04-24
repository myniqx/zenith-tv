import 'package:flutter/material.dart';

import 'view_object.dart';
import 'watchable.dart';
import 'm3u_object.dart';
import '../utils/string_matcher.dart';

/// Cover image item for group thumbnails.
/// Mirrors: shared/content/src/models/group.ts → CoverItem
class CoverItem {
  final String name;
  final String logo;
  final bool isHot;

  const CoverItem(this.name, this.logo, {this.isHot = false});
}

/// A group that contains watchables and/or sub-groups.
/// Mirrors: shared/content/src/models/group.ts → GroupObject
class GroupObject extends ViewObject {
  List<WatchableObject> watchables = [];
  List<GroupObject> groups = [];
  List<CoverItem>? coverImages;

  GroupObject([String groupName = 'Group']) {
    name = groupName;
  }

  /// Mirrors: GroupObject.GetListIcon in desktop
  IconData get listIcon => Icons.folder_outlined;

  void clear() {
    watchables = [];
    groups = [];
  }

  bool shouldFilter(ViewObject v) => upperLevel?.shouldFilter(v) ?? false;

  void justAdd(WatchableObject item) => watchables.add(item);

  void justRemove(WatchableObject item) => watchables.remove(item);

  void removeWatchable(WatchableObject watchable) => justRemove(watchable);

  int localCount() => groups.length + watchables.length;

  /// Removes empty sub-groups and sorts everything.
  /// Mirrors: GroupObject.lastCheck()
  void lastCheck() {
    for (var i = groups.length - 1; i >= 0; i--) {
      groups[i].lastCheck();
      if (groups[i].totalCount == 0) groups.removeAt(i);
    }
    int compare(ViewObject a, ViewObject b) {
      if (a.isSticky && !b.isSticky) return -1;
      if (!a.isSticky && b.isSticky) return 1;
      if (a.addedDate != null && b.addedDate != null) {
        final diff = b.addedDate!.compareTo(a.addedDate!);
        if (diff != 0) return diff;
      } else if (a.addedDate != null) {
        return -1;
      } else if (b.addedDate != null) {
        return 1;
      }
      return a.name.compareTo(b.name);
    }

    groups.sort(compare);
    watchables.sort(compare);
  }

  /// Random cover images from watchables (up to [limit]).
  List<CoverItem> getImageList([int limit = 9]) {
    if (coverImages != null) return coverImages!;
    final result = <CoverItem>[];

    final indices = _randomIndices(watchables.length, limit);
    for (final i in indices) {
      final w = watchables[i];
      result.add(CoverItem(w.name, w.logo, isHot: w.isHot));
    }

    if (result.length < limit) {
      final temp = <CoverItem>[];
      for (final g in groups) { temp.addAll(g.getImageList()); }
      final extra = _randomIndices(temp.length, limit - result.length);
      for (final i in extra) { result.add(temp[i]); }
    }

    coverImages = result;
    return result;
  }

  int get totalCount =>
      groups.fold(0, (sum, g) => sum + g.totalCount) + watchables.length;

  int get liveStreamCount =>
      groups.fold(0, (sum, g) => sum + g.liveStreamCount) +
      watchables.where((w) => w.category == M3UCategory.liveStream).length;

  int get tvShowSeasonCount {
    var total = 0;
    for (final g in groups) {
      if (g is TvShowGroupObject) {
        total += g.seasonCount;
      } else {
        total += g.tvShowSeasonCount;
      }
    }

    return total;
  }

  int get tvShowEpisodeCount {
    var total = 0;
    for (final g in groups) {
      if (g is TvShowGroupObject) {
        total += g.episodeCount;
      } else {
        total += g.tvShowEpisodeCount;
      }
    }
    return total;
  }

  int get movieCount {
    var total = 0;
    for (final g in groups) {
      if (g is TvShowGroupObject || g is TvShowSeasonGroupObject) continue;
      total += g.movieCount;
    }
    return total +
        watchables.where((w) => w.category == M3UCategory.movie).length;
  }

  int get tvShowCount => groups.fold(
        0,
        (sum, g) => g is TvShowGroupObject ? sum + 1 : sum + g.tvShowCount,
      );

  bool hasItem(WatchableObject item) {
    final g = groups.where((g) => g.title == item.title).firstOrNull;
    return g != null && g.watchables.any((w) => w.url == item.url);
  }

  bool has(M3UObject item) {
    final g = groups.where((g) => g.title == item.title).firstOrNull;
    return g != null && g.watchables.any((w) => w.url == item.url);
  }

  WatchableObject add(M3UObject m3u) {
    final obj = WatchableObject();
    _setFrom(obj, m3u);
    obj.upperLevel = this;
    return addWatchable(obj);
  }

  WatchableObject addWatchable(WatchableObject watchable) {
    watchables.add(watchable);
    return watchable;
  }

  WatchableObject? findByUrl(String url) {
    for (final g in groups) {
      final obj = g.findByUrl(url);
      if (obj != null) return obj;
    }
    return watchables.where((w) => w.url == url).firstOrNull;
  }

  WatchableObject addTvShow(M3UObject m3u) {
    final tvShowGroup = addTvGroup(m3u.title);
    final tvShowSeason = tvShowGroup.addSeason(m3u.season ?? 1);
    final tvShow = TvShowWatchableObject();
    _setFrom(tvShow, m3u);
    tvShow.upperLevel = tvShowSeason;
    tvShowSeason.watchables.add(tvShow);
    return tvShow;
  }

  GroupObject addGroup(String groupName) {
    if (groupName.isEmpty) groupName = 'unnamed group';
    final existing = groups.where((g) => g.name == groupName).firstOrNull;
    if (existing != null) return existing;
    final g = GroupObject(groupName);
    g.upperLevel = this;
    groups.add(modifyGroupBeforeAdded(g));
    return g;
  }

  TvShowGroupObject addTvGroup(String groupName) {
    if (groupName.isEmpty) groupName = 'unnamed tvshow';
    final existing = groups.where((g) => g.name == groupName).firstOrNull;
    if (existing != null) return existing as TvShowGroupObject;
    final g = TvShowGroupObject(groupName);
    g.upperLevel = this;
    groups.add(modifyGroupBeforeAdded(g));
    return g;
  }

  GroupObject modifyGroupBeforeAdded(GroupObject g) => g;

  void searchProgress(
      GroupObject result, List<String> parts, bool Function() isAborted) {
    for (final g in groups) {
      if (isAborted()) return;
      if (g is TvShowGroupObject) {
        if (StringMatcher.hasMatch(parts, g.name)) result.groups.add(g);
      } else {
        g.searchProgress(result, parts, isAborted);
      }
    }
    for (final w in watchables) {
      if (isAborted()) return;
      if (StringMatcher.hasMatch(parts, w.name)) result.watchables.add(w);
    }
  }

  void _setFrom(WatchableObject watchable, M3UObject m3u) {
    watchable.url = m3u.url;
    watchable.logo = m3u.logo ?? '';
    watchable.name = m3u.title;
    watchable.year = m3u.year;
    watchable.category = m3u.category;
    if (watchable is TvShowWatchableObject) {
      watchable.season = m3u.season ?? 1;
      watchable.episode = m3u.episode ?? 1;
    }
  }

  static List<int> _randomIndices(int max, int n) {
    if (max == 0) return [];
    final pool = List.generate(max, (i) => i);
    pool.shuffle();
    return pool.take(n).toList();
  }
}

/// A TV show (contains seasons as sub-groups).
/// Mirrors: shared/content/src/models/group.ts → TvShowGroupObject
class TvShowGroupObject extends GroupObject {
  TvShowGroupObject([super.groupName = 'TvShow']);

  @override
  String get title => 'Tv Shows';

  @override
  IconData get listIcon => Icons.tv;

  int get episodeCount => groups.fold(
        watchables.length,
        (sum, g) =>
            g is TvShowSeasonGroupObject ? sum + g.episodeCount : sum,
      );

  int get seasonCount => groups.length;

  TvShowSeasonGroupObject addSeason(int season) {
    season = season < 1 ? 1 : season;
    final seasonName = 'Season $season';
    final existing =
        groups.where((g) => g.name == seasonName).firstOrNull;
    if (existing != null) return existing as TvShowSeasonGroupObject;
    final g = TvShowSeasonGroupObject();
    g.season = season;
    g.name = seasonName;
    g.upperLevel = this;
    groups.add(g);
    return g;
  }

  TvShowSeasonGroupObject? getSeason(int season) =>
      groups
          .whereType<TvShowSeasonGroupObject>()
          .where((g) => g.season == season)
          .firstOrNull;

  TvShowWatchableObject? getEpisode(int season, int episode) =>
      getSeason(season)?.getEpisode(episode);
}

/// A season within a TV show (contains episodes as watchables).
/// Mirrors: shared/content/src/models/group.ts → TvShowSeasonGroupObject
class TvShowSeasonGroupObject extends GroupObject {
  int season = 0;

  @override
  IconData get listIcon => Icons.calendar_view_week_outlined;

  int get episodeCount => watchables.length;

  TvShowWatchableObject? getEpisode(int episode) => watchables
      .whereType<TvShowWatchableObject>()
      .where((w) => w.episode == episode)
      .firstOrNull;
}
