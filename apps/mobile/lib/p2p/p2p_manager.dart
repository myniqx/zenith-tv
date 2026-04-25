import 'dart:async';
import 'client/p2p_client_store.dart';
import 'server/p2p_server_store.dart';
import 'models/index.dart';
import 'utils/merge_user_data.dart' as merge_utils;

/// Routes incoming P2P messages to the appropriate handler.
///
/// Client mode (TV / tablet playing video, controlled by a remote):
///   - Routes open/playback/audio/video/subtitle/window/shortcut → player store
///   - Responds to state_request with a full client_event snapshot immediately
///   - Broadcasts full player state every 500 ms as client_event
///   - Handles profile_sync flow (profile info → M3U request → userData merge)
///
/// Server mode (phone/tablet acting as remote control):
///   - Routes client_event from player device → remote player state store
///   - Handles profile_sync responses from connected clients
///
/// Mirrors: apps/tizen/src/components/P2P/P2PManager.tsx
class P2PManager {
  static const Duration _stateBroadcastInterval = Duration(milliseconds: 500);

  final P2PClientStore? clientStore;
  final P2PServerStore? serverStore;

  /// Called when an open/playback/audio/video/subtitle/window/shortcut command arrives.
  final void Function(String type, Map<String, dynamic>? payload)? onPlayerCommand;

  /// Called to read current player state for client_event broadcast.
  final Map<String, dynamic> Function()? getPlayerState;

  /// Called when a client_event arrives from a remote player (server mode).
  final void Function(Map<String, dynamic> state)? onRemoteStateUpdate;

  /// Called when profile sync data arrives — host app handles persistence.
  final Future<void> Function(ProfileSyncPayload payload, void Function(P2PMessage) reply)? onProfileSync;

  /// Called when a new client connects in server mode.
  /// Should return the welcome profile_sync payload to send to the client,
  /// or null if no active profile exists yet.
  final ProfileSyncPayload? Function(String connectionId)? onClientConnected;

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
    this.onClientConnected,
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
      case P2PMessageType.handshakeRequest:
        // Server is asking who we are — respond with our identity
        clientStore?.sendMessage(P2PMessage(
          type: P2PMessageType.handshakeResponse,
          payload: {
            'deviceId': clientStore?.trustedServers.firstOrNull?.deviceId ?? 'unknown',
            'deviceName': 'Zenith TV Mobile',
            'appVersion': '1.0.0',
          },
        ));
        break;

      case P2PMessageType.open:
      case P2PMessageType.playback:
      case P2PMessageType.audio:
      case P2PMessageType.video:
      case P2PMessageType.subtitle:
      case P2PMessageType.window:
      case P2PMessageType.shortcut:
        onPlayerCommand?.call(type, payload);
        break;

      case P2PMessageType.stateRequest:
        final state = getPlayerState?.call();
        if (state != null) {
          clientStore?.sendMessage(P2PMessage(
            type: P2PMessageType.clientEvent,
            payload: state,
          ));
        }
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
        type: P2PMessageType.clientEvent,
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
      case P2PMessageType.handshakeResponse:
        if (payload == null) return;
        final deviceId   = payload['deviceId']   as String? ?? 'unknown';
        final deviceName = payload['deviceName'] as String? ?? 'Unknown Device';

        serverStore?.updateHandshake(connectionId,
            deviceId: deviceId, deviceName: deviceName);

        // If already trusted → proceed with profile_sync immediately
        if (serverStore?.isTrusted(deviceId) ?? false) {
          _sendWelcome(connectionId);
        }
        // Otherwise UI shows Trust button — profile_sync waits for user action
        break;

      case P2PMessageType.clientEvent:
        if (payload != null) onRemoteStateUpdate?.call(payload);
        break;

      case P2PMessageType.profileSync:
        if (payload != null) {
          _handleProfileSyncAsServer(
              connectionId, ProfileSyncPayload.fromJson(payload));
        }
        break;
    }
  }

  /// Send the welcome profile_sync to a newly trusted/verified client.
  void sendWelcomeToConnection(String connectionId) {
    _sendWelcome(connectionId);
  }

  void _sendWelcome(String connectionId) {
    final welcome = onClientConnected?.call(connectionId);
    if (welcome == null) return;
    serverStore?.sendTo(
      connectionId,
      P2PMessage(type: P2PMessageType.profileSync, payload: welcome.toJson()),
    );
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
