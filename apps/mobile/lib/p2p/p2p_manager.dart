import 'dart:async';
import 'client/p2p_client_store.dart';
import 'server/p2p_server_store.dart';
import 'models/index.dart';
import 'utils/merge_user_data.dart' as merge_utils;

/// Routes incoming P2P messages to the appropriate handler.
///
/// Client mode (TV / phone connected to desktop):
///   - Routes open/playback/audio/video/subtitle/window/shortcut → player store
///   - Broadcasts player state every 2 seconds as state_update
///   - Handles profile_sync flow (profile info → M3U request → userData merge)
///
/// Server mode (phone/tablet acting as controller):
///   - Routes state_update from player device → remote player state store
///   - Handles profile_sync responses from connected clients
///
/// Mirrors: apps/tizen/src/components/P2P/P2PManager.tsx
///          apps/desktop/src/components/P2P/P2PManager.tsx
class P2PManager {
  static const Duration _stateBroadcastInterval = Duration(seconds: 2);

  final P2PClientStore? clientStore;
  final P2PServerStore? serverStore;

  /// Called when an open/playback/audio/video/subtitle/window/shortcut command arrives.
  final void Function(String type, Map<String, dynamic>? payload)? onPlayerCommand;

  /// Called to read current player state for state_update broadcast.
  final Map<String, dynamic> Function()? getPlayerState;

  /// Called when a state_update arrives from a remote player (server mode).
  final void Function(Map<String, dynamic> state)? onRemoteStateUpdate;

  /// Called when profile sync data arrives — host app handles persistence.
  final Future<void> Function(ProfileSyncPayload payload, void Function(P2PMessage) reply)? onProfileSync;

  StreamSubscription? _clientMessageSub;
  StreamSubscription? _serverMessageSub;
  Timer? _broadcastTimer;

  P2PManager({
    this.clientStore,
    this.serverStore,
    this.onPlayerCommand,
    this.getPlayerState,
    this.onRemoteStateUpdate,
    this.onProfileSync,
  });

  // ---------------------------------------------------------------------------

  void init() {
    _setupClientListeners();
    _setupServerListeners();
  }

  void dispose() {
    _clientMessageSub?.cancel();
    _serverMessageSub?.cancel();
    _broadcastTimer?.cancel();
  }

  // --- Client mode ---

  void _setupClientListeners() {
    final client = clientStore;
    if (client == null) return;

    _clientMessageSub = client.messageStream.listen(_handleClientMessage);

    client.addListener(_onClientStatusChanged);
  }

  void _onClientStatusChanged() {
    final client = clientStore;
    if (client == null) return;

    if (client.isConnected) {
      _startBroadcast();
    } else {
      _stopBroadcast();
    }
  }

  void _handleClientMessage(Map<String, dynamic> raw) {
    final type = raw['type'] as String?;
    if (type == null) return;

    final payload = raw['payload'] as Map<String, dynamic>?;

    switch (type) {
      case P2PMessageType.open:
      case P2PMessageType.playback:
      case P2PMessageType.audio:
      case P2PMessageType.video:
      case P2PMessageType.subtitle:
      case P2PMessageType.window:
      case P2PMessageType.shortcut:
        onPlayerCommand?.call(type, payload);
        break;

      case P2PMessageType.stateUpdate:
        // Client is the player — ignore state_update coming from server
        break;

      case P2PMessageType.profileSync:
        if (payload != null) {
          _handleProfileSyncAsClient(ProfileSyncPayload.fromJson(payload));
        }
        break;
    }
  }

  void _handleProfileSyncAsClient(ProfileSyncPayload payload) {
    onProfileSync?.call(payload, (reply) {
      clientStore?.sendMessage(reply);
    });
  }

  void _startBroadcast() {
    _broadcastTimer?.cancel();
    _broadcastTimer = Timer.periodic(_stateBroadcastInterval, (_) {
      final state = getPlayerState?.call();
      if (state == null) return;
      clientStore?.sendMessage(P2PMessage(
        type: P2PMessageType.stateUpdate,
        payload: state,
      ));
    });
  }

  void _stopBroadcast() {
    _broadcastTimer?.cancel();
    _broadcastTimer = null;
  }

  // --- Server mode ---

  void _setupServerListeners() {
    final server = serverStore;
    if (server == null) return;

    _serverMessageSub = server.messageStream.listen((event) {
      _handleServerMessage(event.connectionId, event.message);
    });
  }

  void _handleServerMessage(String connectionId, Map<String, dynamic> raw) {
    final type = raw['type'] as String?;
    if (type == null) return;

    final payload = raw['payload'] as Map<String, dynamic>?;

    switch (type) {
      case P2PMessageType.stateUpdate:
        if (payload != null) {
          onRemoteStateUpdate?.call(payload);
        }
        break;

      case P2PMessageType.profileSync:
        if (payload != null) {
          _handleProfileSyncAsServer(
            connectionId,
            ProfileSyncPayload.fromJson(payload),
          );
        }
        break;
    }
  }

  void _handleProfileSyncAsServer(
    String connectionId,
    ProfileSyncPayload payload,
  ) {
    onProfileSync?.call(payload, (reply) {
      serverStore?.sendTo(connectionId, reply);
    });
  }

  // ---------------------------------------------------------------------------

  /// Utility: merge two raw userData maps (timestamp-based).
  /// Exposed so host app can call it without importing utils directly.
  static Map<String, dynamic> mergeUserData(
    Map<String, dynamic> local,
    Map<String, dynamic> remote,
  ) {
    return merge_utils.mergeUserData(local, remote);
  }
}
