import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/index.dart';
import 'p2p_server.dart';

class TrustedClient {
  final String deviceId;
  final String deviceName;
  final int trustedAt;

  const TrustedClient({
    required this.deviceId,
    required this.deviceName,
    required this.trustedAt,
  });

  factory TrustedClient.fromJson(Map<String, dynamic> json) => TrustedClient(
        deviceId: json['deviceId'] as String,
        deviceName: json['deviceName'] as String,
        trustedAt: json['trustedAt'] as int,
      );

  Map<String, dynamic> toJson() => {
        'deviceId': deviceId,
        'deviceName': deviceName,
        'trustedAt': trustedAt,
      };
}

/// High-level P2P server state manager.
class P2PServerStore extends ChangeNotifier {
  static const int defaultPort = 8080;
  static const String _prefsKey = 'zenith_p2p_trusted_clients';

  P2PServer? _server;

  bool _isRunning = false;
  int _port = defaultPort;
  final List<P2PConnection> _connections = [];
  String? _selectedDeviceId;
  String? _error;
  List<TrustedClient> _trustedClients = [];

  final _messageController =
      StreamController<({String connectionId, Map<String, dynamic> message})>.broadcast();
  final List<void Function(String connectionId)> _connectionListeners = [];

  /// Called after a device is trusted — used by P2PManager to send welcome profile_sync.
  void Function(String connectionId)? onTrusted;

  bool get isRunning => _isRunning;
  int get port => _port;
  List<P2PConnection> get connections => List.unmodifiable(_connections);
  String? get selectedDeviceId => _selectedDeviceId;
  String? get error => _error;
  int get connectionCount => _connections.length;
  P2PServer? get server => _server;
  List<TrustedClient> get trustedClients => List.unmodifiable(_trustedClients);

  Stream<({String connectionId, Map<String, dynamic> message})> get messageStream =>
      _messageController.stream;

  P2PConnection? get selectedConnection {
    if (_selectedDeviceId == null) return null;
    return _connections.where((c) => c.id == _selectedDeviceId).firstOrNull;
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  Future<void> loadTrustedClients() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw == null) return;
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      _trustedClients = list
          .map((e) => TrustedClient.fromJson(e as Map<String, dynamic>))
          .toList();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> _saveTrustedClients() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _prefsKey,
      jsonEncode(_trustedClients.map((c) => c.toJson()).toList()),
    );
  }

  bool isTrusted(String deviceId) =>
      _trustedClients.any((c) => c.deviceId == deviceId);

  Future<void> trustClient(String connectionId) async {
    final conn = _connections.where((c) => c.id == connectionId).firstOrNull;
    if (conn == null || conn.deviceId == null) return;

    if (!isTrusted(conn.deviceId!)) {
      _trustedClients.add(TrustedClient(
        deviceId: conn.deviceId!,
        deviceName: conn.deviceName ?? 'Unknown Device',
        trustedAt: DateTime.now().millisecondsSinceEpoch,
      ));
      await _saveTrustedClients();
    }

    notifyListeners();
    onTrusted?.call(connectionId);
  }

  Future<void> removeTrustedClient(String deviceId) async {
    _trustedClients.removeWhere((c) => c.deviceId == deviceId);
    await _saveTrustedClients();
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Server lifecycle
  // ---------------------------------------------------------------------------

  Future<void> startServer({int port = defaultPort, required String deviceName}) async {
    if (_isRunning) return;

    _error = null;
    _port = port;

    _server = P2PServer(deviceName: deviceName, port: port);

    _server!.onConnection = (connectionId, ip) {
      _connections.add(P2PConnection(
        id: connectionId,
        ip: ip,
        connectedAt: DateTime.now().millisecondsSinceEpoch,
        handshake: HandshakeStatus.pending,
      ));
      _selectedDeviceId ??= connectionId;
      for (final l in _connectionListeners) { l(connectionId); }
      notifyListeners();
    };

    _server!.onMessage = (connectionId, message) {
      _messageController.add((connectionId: connectionId, message: message));
    };

    _server!.onDisconnection = (connectionId) {
      _connections.removeWhere((c) => c.id == connectionId);
      if (_selectedDeviceId == connectionId) {
        _selectedDeviceId = _connections.isNotEmpty ? _connections.first.id : null;
      }
      notifyListeners();
    };

    try {
      await _server!.start();
      _isRunning = true;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to start server: $e';
      _server = null;
      notifyListeners();
    }
  }

  Future<void> stopServer() async {
    await _server?.stop();
    _server = null;
    _isRunning = false;
    _connections.clear();
    _selectedDeviceId = null;
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Connection management
  // ---------------------------------------------------------------------------

  void updateHandshake(String connectionId, {
    required String deviceId,
    required String deviceName,
  }) {
    _server?.handshakeCompleted(connectionId);
    _updateConnection(connectionId,
        deviceId: deviceId,
        deviceName: deviceName,
        handshake: HandshakeStatus.completed);
    notifyListeners();
  }

  Future<void> closeConnection(String connectionId) async {
    await _server?.closeConnection(connectionId);
  }

  void _updateConnection(String connectionId, {
    String? deviceId,
    String? deviceName,
    HandshakeStatus? handshake,
  }) {
    final idx = _connections.indexWhere((c) => c.id == connectionId);
    if (idx < 0) return;
    _connections[idx] = _connections[idx].copyWith(
      deviceId: deviceId,
      deviceName: deviceName,
      handshake: handshake,
    );
  }

  // ---------------------------------------------------------------------------
  // Messaging
  // ---------------------------------------------------------------------------

  bool sendToSelected(P2PMessage message) {
    if (_selectedDeviceId == null || _server == null) return false;
    return _server!.send(_selectedDeviceId!, message);
  }

  bool sendTo(String connectionId, P2PMessage message) {
    return _server?.send(connectionId, message) ?? false;
  }

  void broadcast(P2PMessage message) {
    _server?.broadcast(message);
  }

  void addConnectionListener(void Function(String) listener) =>
      _connectionListeners.add(listener);

  void removeConnectionListener(void Function(String) listener) =>
      _connectionListeners.remove(listener);

  void selectDevice(String connectionId) {
    if (!_connections.any((c) => c.id == connectionId)) return;
    _selectedDeviceId = connectionId;
    notifyListeners();
  }

  // ---------------------------------------------------------------------------

  @override
  Future<void> dispose() async {
    _connectionListeners.clear();
    await stopServer();
    await _messageController.close();
    super.dispose();
  }
}
