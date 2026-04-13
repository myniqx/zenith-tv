import 'package:flutter/foundation.dart';
import '../p2p/models/client_event.dart';
import 'media_player_store.dart';
import 'remote_player_store.dart';

/// P2P mode values — mirrors apps/desktop/src/stores/p2pStore.ts
enum P2PMode { off, client, server }

/// Facade store that delegates to the active player source based on P2P mode:
///
///   off / client → MediaPlayerStore (local ExoPlayer, source of truth)
///   server       → RemotePlayerStore (mirror fed by client_event packets)
///
/// Components read from this store regardless of which backend is active.
/// Mirrors: apps/desktop/src/stores/universalPlayerStore.ts
class UniversalPlayerStore extends ChangeNotifier {
  final MediaPlayerStore localPlayer;
  final RemotePlayerStore remotePlayer;

  P2PMode _mode = P2PMode.off;
  P2PMode get mode => _mode;

  bool get _isServerMode => _mode == P2PMode.server;

  UniversalPlayerStore({
    required this.localPlayer,
    required this.remotePlayer,
  }) {
    localPlayer.addListener(_onSourceChanged);
    remotePlayer.addListener(_onSourceChanged);
  }

  void _onSourceChanged() => notifyListeners();

  // ---------------------------------------------------------------------------
  // Mode switching
  // ---------------------------------------------------------------------------

  void setMode(P2PMode mode) {
    if (_mode == mode) return;
    _mode = mode;
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // State — proxied from the active source
  // ---------------------------------------------------------------------------

  String get playerState =>
      _isServerMode ? remotePlayer.playerState : localPlayer.playerState;

  double get time =>
      _isServerMode ? remotePlayer.time : localPlayer.time;

  double get duration =>
      _isServerMode ? remotePlayer.duration : localPlayer.duration;

  double get position =>
      _isServerMode ? remotePlayer.position : localPlayer.position;

  double get buffering =>
      _isServerMode ? remotePlayer.buffering : localPlayer.buffering;

  double get volume =>
      _isServerMode ? remotePlayer.volume : localPlayer.volume;

  bool get isMuted =>
      _isServerMode ? remotePlayer.isMuted : localPlayer.isMuted;

  double get rate =>
      _isServerMode ? remotePlayer.rate : localPlayer.rate;

  bool get isSeekable =>
      _isServerMode ? remotePlayer.isSeekable : localPlayer.isSeekable;

  String? get error =>
      _isServerMode ? remotePlayer.error : localPlayer.error;

  String? get currentUrl =>
      _isServerMode ? remotePlayer.currentUrl : localPlayer.currentUrl;

  List<VlcTrack> get audioTracks =>
      _isServerMode ? remotePlayer.audioTracks : localPlayer.audioTracks;

  List<VlcTrack> get subtitleTracks =>
      _isServerMode ? remotePlayer.subtitleTracks : localPlayer.subtitleTracks;

  int get currentAudioTrack =>
      _isServerMode ? remotePlayer.currentAudioTrack : localPlayer.currentAudioTrack;

  int get currentSubtitleTrack =>
      _isServerMode ? remotePlayer.currentSubtitleTrack : localPlayer.currentSubtitleTrack;

  // ---------------------------------------------------------------------------
  // Commands — always forwarded to local player.
  // In server mode these are sent over P2P by P2PManager; local player
  // is not called directly (phone has no local video, tablet/TV in server
  // mode are acting as remote control).
  // ---------------------------------------------------------------------------

  Future<void> open(String url) => localPlayer.open(url);

  Future<void> playback({
    String? action,
    double? time,
    double? position,
    double? rate,
  }) =>
      localPlayer.playback(
        action: action,
        time: time,
        position: position,
        rate: rate,
      );

  Future<void> audio({double? volume, bool? mute, int? track}) =>
      localPlayer.audio(volume: volume, mute: mute, track: track);

  Future<void> subtitle({int? track}) => localPlayer.subtitle(track: track);

  // ---------------------------------------------------------------------------
  // P2P helpers
  // ---------------------------------------------------------------------------

  /// Called by P2PManager when a client_event arrives in server mode.
  void applyClientEvent(ClientEventData event) {
    remotePlayer.applyClientEvent(event);
  }

  /// Called by P2PManager to get current state for client_event broadcast.
  ClientEventData getFullClientEvent() => localPlayer.getFullClientEvent();

  // ---------------------------------------------------------------------------

  @override
  void dispose() {
    localPlayer.removeListener(_onSourceChanged);
    remotePlayer.removeListener(_onSourceChanged);
    super.dispose();
  }
}
