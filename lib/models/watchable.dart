import 'view_object.dart';
import 'm3u_object.dart';
import 'user_data.dart';

/// A playable item (movie, live stream, or TV episode).
/// Mirrors: shared/content/src/models/watchable.ts → WatchableObject
class WatchableObject extends ViewObject {
  String url = '';
  String group = '';
  int? year;
  int? durationMs;
  UserItemData userData = UserItemData.empty;
  M3UCategory category = M3UCategory.liveStream;

  /// Derived from userData.favorite and userData.watchProgress.
  ListType get listed {
    if (userData.favorite?.value == true) return ListType.favorite;
    if (userData.watchProgress?.watched != null) return ListType.watched;
    return ListType.none;
  }

  @override
  String get title => category.toJson(); // 'Movie' | 'Series' | 'LiveStream'

  M3UObject toM3UObject() => M3UObject(
        title: name,
        url: url,
        group: group,
        category: category,
        logo: logo.isEmpty ? null : logo,
        year: year,
      );
}

/// A TV show episode.
/// Mirrors: shared/content/src/models/watchable.ts → TvShowWatchableObject
class TvShowWatchableObject extends WatchableObject {
  int season = 0;
  int episode = 0;

  @override
  String get title => 'Tv Shows';

  @override
  M3UObject toM3UObject() => M3UObject(
        title: name,
        url: url,
        group: group,
        category: M3UCategory.series,
        logo: logo.isEmpty ? null : logo,
        year: year,
        season: season,
        episode: episode,
      );
}
