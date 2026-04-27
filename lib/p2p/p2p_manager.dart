import 'dart:async';
import 'client/p2p_client_store.dart';
import 'server/p2p_server_store.dart';
import 'models/index.dart';
import 'utils/merge_user_data.dart' as merge_utils;

/// Routes incoming P2P messages to the appropriate handler.
/// Pure orchestrator — holds no UI state, is not a ChangeNotifier.
///
/// Client mode (TV / tablet playing video, controlled by a remote):
///   - Routes open/playback/audio/video/subtitle/window/shortcut → player store
///   - Responds to state_request with a full client_event snapshot immediately
///   - Broadcasts full player state every 500 ms as client_event
///   - Handles profile_sync flow (profile info → M3U request → userData merge)
///
/// Server mode (phone/tablet acting as remote control):
///   - Routes client_event from selected client → remote player state store
///   - Handles profile_sync responses from connected clients
///
/// Mirrors: apps/tizen/src/components/P2P/P2PManager.tsx
class P2PManager {
  static const Duration _stateBroadcastInterval = Duration(milliseconds: 500);

  final P2PClientStore? clientStore;
  final P2PServerStore? serverStore;

  /// Called when an open/playback/audio/video/subtitle/window/shortcut command arrives.
  void Function(String type, Map<String, dynamic>? payload)? onPlayerCommand;

  /// Called to read current player state for client_event broadcast.
  Map<String, dynamic> Function()? getPlayerState;

  /// Called when a client_event arrives from a remote player (server mode).
  void Function(Map<String, dynamic> state)? onRemoteStateUpdate;

  /// Called when profile sync data arrives — host app handles persistence.
  Future<void> Function(ProfileSyncPayload payload, void Function(P2PMessage) reply)? onProfileSync;

  /// Called when a new client connects in server mode.
  /// Should return the welcome profile_sync payload to send to the client,
  /// or null if no active profile exists yet.
  ProfileSyncPayload? Function(String connectionId)? onClientConnected;

  /// Returns the display name of this device — used in handshake response.
  String Function()? getDeviceName;

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

  /// Called after init. Decides which side to auto-start based on available roles and lastP2PMode.
  /// [lastP2PMode] should be the persisted value from SettingsStore ('server'|'client'|'off').
  Future<void> prepare({required String deviceName, required String lastP2PMode}) async {
    final hasServer = serverStore != null;
    final hasClient = clientStore != null;

    if (hasServer && hasClient) {
      // Tablet: last user choice is authoritative
      if (lastP2PMode == 'server') {
        await serverStore!.prepare(deviceName: deviceName);
      } else if (lastP2PMode == 'client') {
        clientStore!.prepare();
      }
      // lastP2PMode == 'off' → do nothing
    } else if (hasServer) {
      await serverStore!.prepare(deviceName: deviceName);
    } else if (hasClient) {
      clientStore!.prepare();
    }
  }

  void dispose() {
    clientStore?.removeListener(_onClientStatusChanged);
    serverStore?.removeDisconnectionListener(_onServerDisconnection);
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
        clientStore?.sendMessage(P2PMessage(
          type: P2PMessageType.handshakeResponse,
          payload: {
            'deviceId': clientStore?.deviceId ?? 'unknown',
            'deviceName': getDeviceName?.call() ?? 'Zenith TV',
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

    server.addDisconnectionListener(_onServerDisconnection);
  }

  void _onServerDisconnection(String connectionId) {
    // If the disconnected client was selected, fall back to next available
    final server = serverStore;
    if (server == null) return;
    if (server.selectedDeviceId != connectionId) return;
    final remaining = server.connections
        .where((c) => c.id != connectionId)
        .toList();
    server.selectDevice(remaining.isNotEmpty ? remaining.first.id : null);
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

        if (serverStore?.isTrusted(deviceId) ?? false) {
          _sendWelcome(connectionId);
        }
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
  static Map<String, dynamic> mergeUserData(
    Map<String, dynamic> local,
    Map<String, dynamic> remote,
  ) {
    return merge_utils.mergeUserData(local, remote);
  }
}
