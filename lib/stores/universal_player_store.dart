import 'package:flutter/foundation.dart';
import '../core/app_logger.dart';
import '../models/watchable.dart';
import '../p2p/models/client_event.dart';
import '../p2p/models/p2p_message.dart';
import 'media_player_store.dart';
import 'remote_player_store.dart';

/// P2P mode values — mirrors apps/desktop/src/stores/p2pStore.ts
enum P2PMode { off, client, server }

/// Facade store that delegates to the active player source based on P2P mode:
///
///   off / client → MediaPlayerStore (local media_kit, source of truth)
///   server       → RemotePlayerStore (mirror fed by client_event packets)
///
/// Commands in server mode are forwarded over P2P via [sendP2PCommand].
/// Components read from this store regardless of which backend is active.
/// Mirrors: apps/desktop/src/stores/universalPlayerStore.ts
class UniversalPlayerStore extends ChangeNotifier {
  final MediaPlayerStore localPlayer;
  final RemotePlayerStore remotePlayer;

  /// Injected by the app shell — routes commands to the connected P2P client.
  /// Called only when mode == server.
  void Function(String type, Map<String, dynamic> payload)? sendP2PCommand;

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

  // currentItem and isFullscreen are local-only concerns
  WatchableObject? get currentItem => localPlayer.currentItem;
  bool get isFullscreen => localPlayer.isFullscreen;

  List<VlcTrack> get audioTracks =>
      _isServerMode ? remotePlayer.audioTracks : localPlayer.audioTracks;

  List<VlcTrack> get subtitleTracks =>
      _isServerMode ? remotePlayer.subtitleTracks : localPlayer.subtitleTracks;

  int get currentAudioTrack =>
      _isServerMode ? remotePlayer.currentAudioTrack : localPlayer.currentAudioTrack;

  int get currentSubtitleTrack =>
      _isServerMode ? remotePlayer.currentSubtitleTrack : localPlayer.currentSubtitleTrack;

  // ---------------------------------------------------------------------------
  // Commands
  //
  //   local / client mode → MediaPlayerStore (drives media_kit directly)
  //   server mode         → sendP2PCommand (relays to connected player device)
  // ---------------------------------------------------------------------------

  /// Play a watchable item. In server mode: sets currentItem locally (for UI)
  /// and sends open command to the connected client over P2P.
  Future<void> play(WatchableObject item) async {
    AppLogger.app('play: ${item.name} [${item.url}] mode=$_mode');
    await localPlayer.open(item.url, item: item);
    if (_isServerMode) {
      _send(P2PMessageType.open, {'file': item.url});
    }
  }

  /// Stop playback and clear currentItem — closes the player panel.
  Future<void> close() async {
    AppLogger.app('close: mode=$_mode');
    await localPlayer.close();
    if (_isServerMode) {
      _send(P2PMessageType.playback, {'action': 'stop'});
    }
  }

  Future<void> open(String url, {WatchableObject? item}) async {
    if (_isServerMode) {
      _send(P2PMessageType.open, {'file': url});
    } else {
      await localPlayer.open(url, item: item);
    }
  }

  Future<void> playback({
    String? action,
    double? time,
    double? position,
    double? rate,
  }) async {
    if (_isServerMode) {
      _send(P2PMessageType.playback, {
        'action': action, 'time': time, 'position': position, 'rate': rate,
      });
    } else {
      await localPlayer.playback(
        action: action,
        time: time,
        position: position,
        rate: rate,
      );
    }
  }

  Future<void> audio({double? volume, bool? mute, int? track}) async {
    if (_isServerMode) {
      _send(P2PMessageType.audio, {'volume': volume, 'mute': mute, 'track': track});
    } else {
      await localPlayer.audio(volume: volume, mute: mute, track: track);
    }
  }

  Future<void> subtitle({int? track}) async {
    if (_isServerMode) {
      _send(P2PMessageType.subtitle, {'track': track});
    } else {
      await localPlayer.subtitle(track: track);
    }
  }

  void setFullscreen(bool value) => localPlayer.setFullscreen(value);

  void _send(String type, Map<String, dynamic> payload) {
    final filtered = {
      for (final e in payload.entries)
        if (e.value != null) e.key: e.value,
    };
    AppLogger.p2p('→ $type $filtered');
    sendP2PCommand?.call(type, filtered);
  }

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
