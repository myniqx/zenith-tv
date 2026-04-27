// User interaction data per watchable item.
// Mirrors: shared/content/src/types/user-data.ts

/// Mirrors: ListType = 'none' | 'watched' | 'favorite'
enum ListType { none, watched, favorite }

class WatchProgressData {
  final double progress; // 0.0 - 1.0
  final int updatedAt; // Unix ms
  final int? watched; // timestamp when marked watched, null if not

  const WatchProgressData({
    required this.progress,
    required this.updatedAt,
    this.watched,
  });

  factory WatchProgressData.fromJson(Map<String, dynamic> json) =>
      WatchProgressData(
        progress: (json['progress'] as num).toDouble(),
        updatedAt: (json['updatedAt'] as num).toInt(),
        watched: json['watched'] as int?,
      );

  Map<String, dynamic> toJson() => {
        'progress': progress,
        'updatedAt': updatedAt,
        'watched': watched,
      };
}

class TrackSelectionData {
  final int? audio;
  final int? subtitle;
  final int updatedAt;

  const TrackSelectionData({
    this.audio,
    this.subtitle,
    required this.updatedAt,
  });

  factory TrackSelectionData.fromJson(Map<String, dynamic> json) =>
      TrackSelectionData(
        audio: json['audio'] as int?,
        subtitle: json['subtitle'] as int?,
        updatedAt: (json['updatedAt'] as num).toInt(),
      );

  Map<String, dynamic> toJson() => {
        if (audio != null) 'audio': audio,
        if (subtitle != null) 'subtitle': subtitle,
        'updatedAt': updatedAt,
      };
}

class FavoriteData {
  final bool value;
  final int updatedAt;

  const FavoriteData({required this.value, required this.updatedAt});

  factory FavoriteData.fromJson(Map<String, dynamic> json) => FavoriteData(
        value: json['value'] as bool,
        updatedAt: (json['updatedAt'] as num).toInt(),
      );

  Map<String, dynamic> toJson() => {
        'value': value,
        'updatedAt': updatedAt,
      };
}

class HiddenData {
  final bool value;
  final int updatedAt;

  const HiddenData({required this.value, required this.updatedAt});

  factory HiddenData.fromJson(Map<String, dynamic> json) => HiddenData(
        value: json['value'] as bool,
        updatedAt: (json['updatedAt'] as num).toInt(),
      );

  Map<String, dynamic> toJson() => {
        'value': value,
        'updatedAt': updatedAt,
      };
}

/// Per-item user data — favorite, hidden, watch progress, track selections.
/// Mirrors: shared/content/src/types/user-data.ts → UserItemData
class UserItemData {
  final FavoriteData? favorite;
  final HiddenData? hidden;
  final WatchProgressData? watchProgress;
  final TrackSelectionData? tracks;

  const UserItemData({
    this.favorite,
    this.hidden,
    this.watchProgress,
    this.tracks,
  });

  static const empty = UserItemData();

  factory UserItemData.fromJson(Map<String, dynamic> json) => UserItemData(
        favorite: json['favorite'] != null
            ? FavoriteData.fromJson(json['favorite'] as Map<String, dynamic>)
            : null,
        hidden: json['hidden'] != null
            ? HiddenData.fromJson(json['hidden'] as Map<String, dynamic>)
            : null,
        watchProgress: json['watchProgress'] != null
            ? WatchProgressData.fromJson(
                json['watchProgress'] as Map<String, dynamic>)
            : null,
        tracks: json['tracks'] != null
            ? TrackSelectionData.fromJson(
                json['tracks'] as Map<String, dynamic>)
            : null,
      );

  Map<String, dynamic> toJson() => {
        if (favorite != null) 'favorite': favorite!.toJson(),
        if (hidden != null) 'hidden': hidden!.toJson(),
        if (watchProgress != null) 'watchProgress': watchProgress!.toJson(),
        if (tracks != null) 'tracks': tracks!.toJson(),
      };

  UserItemData copyWith({
    FavoriteData? favorite,
    HiddenData? hidden,
    WatchProgressData? watchProgress,
    TrackSelectionData? tracks,
  }) =>
      UserItemData(
        favorite: favorite ?? this.favorite,
        hidden: hidden ?? this.hidden,
        watchProgress: watchProgress ?? this.watchProgress,
        tracks: tracks ?? this.tracks,
      );
}
