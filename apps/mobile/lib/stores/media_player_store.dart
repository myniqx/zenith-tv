import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:media_kit/media_kit.dart';
import '../p2p/models/client_event.dart' as p2p;

// Player state strings — mirrors shared/content/src/types/player.ts → VlcState
abstract final class PlayerState {
  static const String idle = 'idle';
  static const String opening = 'opening';
  static const String buffering = 'buffering';
  static const String playing = 'playing';
  static const String paused = 'paused';
  static const String stopped = 'stopped';
  static const String ended = 'ended';
  static const String error = 'error';
}

/// Android video player store backed by media_kit (ExoPlayer).
/// Mirrors: apps/desktop/src/stores/vlcPlayer.ts
///          apps/tizen/src/stores/tizenPlayer.ts
class MediaPlayerStore extends ChangeNotifier {
  final Player _player = Player();

  // --- State ---
  bool _isInitialized = false;
  String _playerState = PlayerState.idle;
  double _time = 0;
  double _duration = 0;
  double _position = 0;
  // ignore: prefer_final_fields
  double _buffering = 0;
  double _volume = 100;
  bool _isMuted = false;
  double _rate = 1.0;
  bool _isSeekable = false;
  String? _error;
  String? _currentUrl;

  List<p2p.VlcTrack> _audioTracks = [];
  List<p2p.VlcTrack> _subtitleTracks = [];
  int _currentAudioTrack = -1;
  int _currentSubtitleTrack = -1;

  final List<StreamSubscription<dynamic>> _subs = [];

  // --- Getters ---
  bool get isInitialized => _isInitialized;
  String get playerState => _playerState;
  double get time => _time;
  double get duration => _duration;
  double get position => _position;
  double get buffering => _buffering;
  double get volume => _volume;
  bool get isMuted => _isMuted;
  double get rate => _rate;
  bool get isSeekable => _isSeekable;
  String? get error => _error;
  String? get currentUrl => _currentUrl;
  List<p2p.VlcTrack> get audioTracks => List.unmodifiable(_audioTracks);
  List<p2p.VlcTrack> get subtitleTracks => List.unmodifiable(_subtitleTracks);
  int get currentAudioTrack => _currentAudioTrack;
  int get currentSubtitleTrack => _currentSubtitleTrack;

  // ---------------------------------------------------------------------------
  // Init / dispose
  // ---------------------------------------------------------------------------

  Future<void> init() async {
    if (_isInitialized) return;

    _subs.addAll([
      _player.stream.playing.listen((playing) {
        _playerState = playing ? PlayerState.playing : PlayerState.paused;
        notifyListeners();
      }),
      _player.stream.buffering.listen((buffering) {
        if (buffering) {
          _playerState = PlayerState.buffering;
          notifyListeners();
        }
      }),
      _player.stream.position.listen((pos) {
        _time = pos.inMilliseconds / 1000.0;
        final dur = _duration;
        _position = dur > 0 ? (_time / dur).clamp(0.0, 1.0) : 0.0;
        notifyListeners();
      }),
      _player.stream.duration.listen((dur) {
        _duration = dur.inMilliseconds / 1000.0;
        _isSeekable = _duration > 0;
        notifyListeners();
      }),
      _player.stream.volume.listen((vol) {
        _volume = vol;
        notifyListeners();
      }),
      _player.stream.rate.listen((r) {
        _rate = r;
        notifyListeners();
      }),
      _player.stream.tracks.listen((tracks) {
        _audioTracks = tracks.audio
            .map((t) => p2p.VlcTrack(
                  id: int.tryParse(t.id) ?? -1,
                  name: t.title ?? t.language ?? 'Track ${t.id}',
                ))
            .toList();
        _subtitleTracks = tracks.subtitle
            .map((t) => p2p.VlcTrack(
                  id: int.tryParse(t.id) ?? -1,
                  name: t.title ?? t.language ?? 'Sub ${t.id}',
                ))
            .toList();
        notifyListeners();
      }),
      _player.stream.track.listen((track) {
        _currentAudioTrack = int.tryParse(track.audio.id) ?? -1;
        _currentSubtitleTrack = int.tryParse(track.subtitle.id) ?? -1;
        notifyListeners();
      }),
      _player.stream.completed.listen((completed) {
        if (completed) {
          _playerState = PlayerState.ended;
          notifyListeners();
        }
      }),
      _player.stream.error.listen((err) {
        if (err.isNotEmpty) {
          _error = err;
          _playerState = PlayerState.error;
          notifyListeners();
        }
      }),
    ]);

    await _player.setVolume(_volume);

    _isInitialized = true;
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Commands — mirrors vlcPlayerStore unified API
  // ---------------------------------------------------------------------------

  Future<void> open(String url) async {
    _error = null;
    _currentUrl = url;
    _playerState = PlayerState.opening;
    notifyListeners();

    await _player.open(Media(url));
  }

  Future<void> playback({
    String? action,
    double? time,
    double? position,
    double? rate,
  }) async {
    if (action == 'play' || action == 'resume') {
      await _player.play();
    } else if (action == 'pause') {
      await _player.pause();
    } else if (action == 'stop') {
      await _player.stop();
      _playerState = PlayerState.stopped;
      _currentUrl = null;
      notifyListeners();
    }

    if (time != null) {
      await _player.seek(Duration(milliseconds: (time * 1000).round()));
    } else if (position != null) {
      final target = _duration * position;
      await _player.seek(Duration(milliseconds: (target * 1000).round()));
    }

    if (rate != null) {
      await _player.setRate(rate);
    }
  }

  Future<void> audio({
    double? volume,
    bool? mute,
    int? track,
  }) async {
    if (mute != null) {
      _isMuted = mute;
      await _player.setVolume(mute ? 0 : _volume);
      notifyListeners();
    }

    if (volume != null) {
      _volume = volume;
      if (!_isMuted) await _player.setVolume(volume);
      notifyListeners();
    }

    if (track != null) {
      final audioTrack = _player.state.tracks.audio
          .where((t) => int.tryParse(t.id) == track)
          .firstOrNull;
      if (audioTrack != null) {
        await _player.setAudioTrack(audioTrack);
      }
    }
  }

  Future<void> subtitle({int? track}) async {
    if (track == null) return;

    if (track < 0) {
      await _player.setSubtitleTrack(SubtitleTrack.no());
      return;
    }

    final subTrack = _player.state.tracks.subtitle
        .where((t) => int.tryParse(t.id) == track)
        .firstOrNull;
    if (subTrack != null) {
      await _player.setSubtitleTrack(subTrack);
    }
  }

  // ---------------------------------------------------------------------------
  // P2P: build a full ClientEventData snapshot
  // Mirrors: tizenPlayer.getFullVlcEvent() and vlcPlayer.getFullVlcEvent()
  // ---------------------------------------------------------------------------

  p2p.ClientEventData getFullClientEvent() {
    return p2p.ClientEventData(
      mediaInfo: p2p.MediaInfo(
        duration: _duration,
        isSeekable: _isSeekable,
        audioTracks: _audioTracks,
        subtitleTracks: _subtitleTracks,
        videoTracks: [],
        url: _currentUrl,
      ),
      playerInfo: p2p.PlayerSettings(
        volume: _volume,
        muted: _isMuted,
        rate: _rate,
      ),
      currentVideo: p2p.CurrentVideoState(
        time: _time,
        state: _playerState,
        length: _duration,
        position: _position,
        buffering: _buffering,
        isSeekable: _isSeekable,
        audioTrack: _currentAudioTrack,
        subtitleTrack: _currentSubtitleTrack,
      ),
    );
  }

  // ---------------------------------------------------------------------------

  @override
  Future<void> dispose() async {
    for (final sub in _subs) {
      await sub.cancel();
    }
    _subs.clear();
    await _player.dispose();
    super.dispose();
  }
}
