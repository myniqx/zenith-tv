// P2P client→server player state event payload.
// Mirrors: shared/content/src/types/player.ts → ClientEventData
//
// Sent by the player (client) to keep the server UI in sync.
// Same shape is used for both incremental events (one sub-object populated)
// and full-state snapshots (all three populated), so the server handler
// is uniform regardless of source.

// --- VlcTrack ---

class VlcTrack {
  final int id;
  final String name;

  const VlcTrack({required this.id, required this.name});

  factory VlcTrack.fromJson(Map<String, dynamic> json) => VlcTrack(
        id: (json['id'] as num).toInt(),
        name: json['name'] as String,
      );

  Map<String, dynamic> toJson() => {'id': id, 'name': name};
}

// --- MediaInfo ---
// Sent when a new media is loaded. url is injected by the forwarder so
// the server can resolve currentItem via findByUrl.

class MediaInfo {
  final double duration;
  final bool isSeekable;
  final List<VlcTrack> audioTracks;
  final List<VlcTrack> subtitleTracks;
  final List<VlcTrack> videoTracks;
  final String? url;

  const MediaInfo({
    required this.duration,
    required this.isSeekable,
    required this.audioTracks,
    required this.subtitleTracks,
    required this.videoTracks,
    this.url,
  });

  factory MediaInfo.fromJson(Map<String, dynamic> json) => MediaInfo(
        duration: (json['duration'] as num).toDouble(),
        isSeekable: json['isSeekable'] as bool,
        audioTracks: _parseTracks(json['audioTracks']),
        subtitleTracks: _parseTracks(json['subtitleTracks']),
        videoTracks: _parseTracks(json['videoTracks']),
        url: json['url'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'duration': duration,
        'isSeekable': isSeekable,
        'audioTracks': audioTracks.map((t) => t.toJson()).toList(),
        'subtitleTracks': subtitleTracks.map((t) => t.toJson()).toList(),
        'videoTracks': videoTracks.map((t) => t.toJson()).toList(),
        if (url != null) 'url': url,
      };

  static List<VlcTrack> _parseTracks(Object? raw) {
    if (raw is! List) return [];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(VlcTrack.fromJson)
        .toList();
  }
}

// --- PlayerSettings ---
// Sent when volume, mute, rate, or screenMode changes.
// volume < 0 means no audio output (noAudio flag on the receiver side).

class PlayerSettings {
  final double? volume;
  final bool? muted;
  final double? rate;
  final String? screenMode;

  const PlayerSettings({this.volume, this.muted, this.rate, this.screenMode});

  factory PlayerSettings.fromJson(Map<String, dynamic> json) => PlayerSettings(
        volume: (json['volume'] as num?)?.toDouble(),
        muted: json['muted'] as bool?,
        rate: (json['rate'] as num?)?.toDouble(),
        screenMode: json['screenMode'] as String?,
      );

  Map<String, dynamic> toJson() => {
        if (volume != null) 'volume': volume,
        if (muted != null) 'muted': muted,
        if (rate != null) 'rate': rate,
        if (screenMode != null) 'screenMode': screenMode,
      };
}

// --- CurrentVideoState ---
// Sent on every tick that moves time, state, buffering, or any
// per-video setting (tracks, delays, aspect ratio, etc.).

class CurrentVideoState {
  final double? time;
  final String? state; // VlcState values
  final bool? endReached;
  final String? error;
  final double? length;
  final double? position;    // 0.0–1.0
  final double? buffering;   // 0.0–100.0
  final bool? isSeekable;

  final String? aspectRatio;
  final String? crop;
  final double? scale;
  final String? deinterlace;

  final double? audioDelay;
  final double? subtitleDelay;

  final int? audioTrack;
  final int? subtitleTrack;
  final int? videoTrack;

  const CurrentVideoState({
    this.time,
    this.state,
    this.endReached,
    this.error,
    this.length,
    this.position,
    this.buffering,
    this.isSeekable,
    this.aspectRatio,
    this.crop,
    this.scale,
    this.deinterlace,
    this.audioDelay,
    this.subtitleDelay,
    this.audioTrack,
    this.subtitleTrack,
    this.videoTrack,
  });

  factory CurrentVideoState.fromJson(Map<String, dynamic> json) =>
      CurrentVideoState(
        time: (json['time'] as num?)?.toDouble(),
        state: json['state'] as String?,
        endReached: json['endReached'] as bool?,
        error: json['error'] as String?,
        length: (json['length'] as num?)?.toDouble(),
        position: (json['position'] as num?)?.toDouble(),
        buffering: (json['buffering'] as num?)?.toDouble(),
        isSeekable: json['isSeekable'] as bool?,
        aspectRatio: json['aspectRatio'] as String?,
        crop: json['crop'] as String?,
        scale: (json['scale'] as num?)?.toDouble(),
        deinterlace: json['deinterlace'] as String?,
        audioDelay: (json['audioDelay'] as num?)?.toDouble(),
        subtitleDelay: (json['subtitleDelay'] as num?)?.toDouble(),
        audioTrack: (json['audioTrack'] as num?)?.toInt(),
        subtitleTrack: (json['subtitleTrack'] as num?)?.toInt(),
        videoTrack: (json['videoTrack'] as num?)?.toInt(),
      );

  Map<String, dynamic> toJson() => {
        if (time != null) 'time': time,
        if (state != null) 'state': state,
        if (endReached != null) 'endReached': endReached,
        if (error != null) 'error': error,
        if (length != null) 'length': length,
        if (position != null) 'position': position,
        if (buffering != null) 'buffering': buffering,
        if (isSeekable != null) 'isSeekable': isSeekable,
        if (aspectRatio != null) 'aspectRatio': aspectRatio,
        if (crop != null) 'crop': crop,
        if (scale != null) 'scale': scale,
        if (deinterlace != null) 'deinterlace': deinterlace,
        if (audioDelay != null) 'audioDelay': audioDelay,
        if (subtitleDelay != null) 'subtitleDelay': subtitleDelay,
        if (audioTrack != null) 'audioTrack': audioTrack,
        if (subtitleTrack != null) 'subtitleTrack': subtitleTrack,
        if (videoTrack != null) 'videoTrack': videoTrack,
      };
}

// --- ClientEventData ---
// Wire payload for the `client_event` P2P message (player → server).
// Mirrors: shared/content/src/types/player.ts → ClientEventData

class ClientEventData {
  final MediaInfo? mediaInfo;
  final PlayerSettings? playerInfo;
  final CurrentVideoState? currentVideo;

  const ClientEventData({this.mediaInfo, this.playerInfo, this.currentVideo});

  factory ClientEventData.fromJson(Map<String, dynamic> json) =>
      ClientEventData(
        mediaInfo: json['mediaInfo'] == null
            ? null
            : MediaInfo.fromJson(json['mediaInfo'] as Map<String, dynamic>),
        playerInfo: json['playerInfo'] == null
            ? null
            : PlayerSettings.fromJson(
                json['playerInfo'] as Map<String, dynamic>),
        currentVideo: json['currentVideo'] == null
            ? null
            : CurrentVideoState.fromJson(
                json['currentVideo'] as Map<String, dynamic>),
      );

  Map<String, dynamic> toJson() => {
        if (mediaInfo != null) 'mediaInfo': mediaInfo!.toJson(),
        if (playerInfo != null) 'playerInfo': playerInfo!.toJson(),
        if (currentVideo != null) 'currentVideo': currentVideo!.toJson(),
      };
}
