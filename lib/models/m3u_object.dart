/// Raw M3U parse output.
/// Mirrors: shared/content/src/types/m3u-types.ts → M3UObject
enum M3UCategory { movie, series, liveStream }

extension M3UCategoryJson on M3UCategory {
  String toJson() {
    switch (this) {
      case M3UCategory.movie:
        return 'Movie';
      case M3UCategory.series:
        return 'Series';
      case M3UCategory.liveStream:
        return 'LiveStream';
    }
  }

  static M3UCategory fromJson(String value) {
    switch (value) {
      case 'Movie':
        return M3UCategory.movie;
      case 'Series':
        return M3UCategory.series;
      default:
        return M3UCategory.liveStream;
    }
  }
}

class M3UObject {
  final String title;
  final String url;
  final String group;
  final String? logo;
  final M3UCategory category;
  final int? year;
  final int? season;
  final int? episode;

  const M3UObject({
    required this.title,
    required this.url,
    required this.group,
    required this.category,
    this.logo,
    this.year,
    this.season,
    this.episode,
  });

  factory M3UObject.fromJson(Map<String, dynamic> json) => M3UObject(
        title: json['title'] as String,
        url: json['url'] as String,
        group: json['group'] as String,
        category: M3UCategoryJson.fromJson(json['category'] as String),
        logo: json['logo'] as String?,
        year: json['year'] as int?,
        season: json['season'] as int?,
        episode: json['episode'] as int?,
      );

  Map<String, dynamic> toJson() => {
        'title': title,
        'url': url,
        'group': group,
        'category': category.toJson(),
        if (logo != null) 'logo': logo,
        if (year != null) 'year': year,
        if (season != null) 'season': season,
        if (episode != null) 'episode': episode,
      };
}
