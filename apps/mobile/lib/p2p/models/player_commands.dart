// Player command payloads sent from server to player.
// Mirrors: apps/tizen/src/stores/types/player-types.ts

// --- Playback ---

class PlaybackOptions {
  final String? action; // 'play' | 'pause' | 'resume' | 'stop'
  final double? time; // absolute seek position in seconds
  final double? position; // seek position as 0.0–1.0
  final double? rate;

  const PlaybackOptions({this.action, this.time, this.position, this.rate});

  factory PlaybackOptions.fromJson(Map<String, dynamic> json) => PlaybackOptions(
        action: json['action'] as String?,
        time: (json['time'] as num?)?.toDouble(),
        position: (json['position'] as num?)?.toDouble(),
        rate: (json['rate'] as num?)?.toDouble(),
      );
}

// --- Open ---

class OpenOptions {
  final String file;

  const OpenOptions({required this.file});

  factory OpenOptions.fromJson(Map<String, dynamic> json) => OpenOptions(
        file: json['file'] as String? ?? json as dynamic,
      );

  static OpenOptions fromRaw(Object? raw) {
    if (raw is String) return OpenOptions(file: raw);
    return OpenOptions.fromJson(raw as Map<String, dynamic>);
  }
}

// --- Audio ---

class AudioOptions {
  final double? volume;
  final bool? mute;
  final int? track;
  final double? delay;

  const AudioOptions({this.volume, this.mute, this.track, this.delay});

  factory AudioOptions.fromJson(Map<String, dynamic> json) => AudioOptions(
        volume: (json['volume'] as num?)?.toDouble(),
        mute: json['mute'] as bool?,
        track: (json['track'] as num?)?.toInt(),
        delay: (json['delay'] as num?)?.toDouble(),
      );
}

// --- Subtitle ---

class SubtitleOptions {
  final int? track;
  final double? delay;

  const SubtitleOptions({this.track, this.delay});

  factory SubtitleOptions.fromJson(Map<String, dynamic> json) => SubtitleOptions(
        track: (json['track'] as num?)?.toInt(),
        delay: (json['delay'] as num?)?.toDouble(),
      );
}

// --- Video ---

class VideoOptions {
  final int? track;
  final double? scale;
  final String? aspectRatio;

  const VideoOptions({this.track, this.scale, this.aspectRatio});

  factory VideoOptions.fromJson(Map<String, dynamic> json) => VideoOptions(
        track: (json['track'] as num?)?.toInt(),
        scale: (json['scale'] as num?)?.toDouble(),
        aspectRatio: json['aspectRatio'] as String?,
      );
}

// --- Window ---

class WindowOptions {
  final String? screenMode; // 'fullscreen' | 'free' | etc.
  final bool? visible;

  const WindowOptions({this.screenMode, this.visible});

  factory WindowOptions.fromJson(Map<String, dynamic> json) => WindowOptions(
        screenMode: json['screenMode'] as String?,
        visible: json['visible'] as bool?,
      );
}
