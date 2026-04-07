// Mirrors: shared/content/src/types/p2p.ts → ProfileSyncPayload + related types

class ProfileInfo {
  final String username;
  final String uuid;
  final String url;

  const ProfileInfo({
    required this.username,
    required this.uuid,
    required this.url,
  });

  factory ProfileInfo.fromJson(Map<String, dynamic> json) => ProfileInfo(
        username: json['username'] as String,
        uuid: json['uuid'] as String,
        url: json['url'] as String,
      );

  Map<String, dynamic> toJson() => {
        'username': username,
        'uuid': uuid,
        'url': url,
      };
}

class M3UDataSync {
  /// The M3U source URL (not raw content).
  final String source;
  final Map<String, dynamic> update;
  final Map<String, dynamic> stats;

  const M3UDataSync({
    required this.source,
    required this.update,
    required this.stats,
  });

  factory M3UDataSync.fromJson(Map<String, dynamic> json) => M3UDataSync(
        source: json['source'] as String,
        update: json['update'] as Map<String, dynamic>,
        stats: json['stats'] as Map<String, dynamic>,
      );

  Map<String, dynamic> toJson() => {
        'source': source,
        'update': update,
        'stats': stats,
      };
}

class ProfileSyncPayload {
  final ProfileInfo? profile;

  /// 'full' — receiver should send back complete M3U data
  final String? request;

  final M3UDataSync? m3uData;

  /// Raw user data map (favorites, watch progress, track selections)
  final Map<String, dynamic>? userData;

  const ProfileSyncPayload({
    this.profile,
    this.request,
    this.m3uData,
    this.userData,
  });

  factory ProfileSyncPayload.fromJson(Map<String, dynamic> json) {
    return ProfileSyncPayload(
      profile: json['profile'] != null
          ? ProfileInfo.fromJson(json['profile'] as Map<String, dynamic>)
          : null,
      request: json['request'] as String?,
      m3uData: json['m3uData'] != null
          ? M3UDataSync.fromJson(json['m3uData'] as Map<String, dynamic>)
          : null,
      userData: json['userData'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() => {
        if (profile != null) 'profile': profile!.toJson(),
        if (request != null) 'request': request,
        if (m3uData != null) 'm3uData': m3uData!.toJson(),
        if (userData != null) 'userData': userData,
      };
}
