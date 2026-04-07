import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/index.dart';
import 'p2p_server.dart';

/// High-level P2P server state manager.
/// Manages server lifecycle, active connections, and selectedDeviceId.
/// Mirrors: apps/desktop/electron/ipc/p2pServer.ts + apps/desktop/src/stores/p2pStore.ts (server side)
class P2PServerStore extends ChangeNotifier {
  static const int defaultPort = 8080;

  P2PServer? _server;

  // --- State ---
  bool _isRunning = false;
  int _port = defaultPort;
  final List<P2PConnection> _connections = [];
  String? _selectedDeviceId;
  String? _error;

  // --- Message stream ---
  final _messageController =
      StreamController<({String connectionId, Map<String, dynamic> message})>.broadcast();

  // --- Getters ---
  bool get isRunning => _isRunning;
  int get port => _port;
  List<P2PConnection> get connections => List.unmodifiable(_connections);
  String? get selectedDeviceId => _selectedDeviceId;
  String? get error => _error;
  int get connectionCount => _connections.length;

  P2PServer? get server => _server;

  /// Raw message stream — P2PManager listens to this.
  Stream<({String connectionId, Map<String, dynamic> message})> get messageStream =>
      _messageController.stream;

  P2PConnection? get selectedConnection {
    if (_selectedDeviceId == null) return null;
    return _connections.where((c) => c.id == _selectedDeviceId).firstOrNull;
  }

  // ---------------------------------------------------------------------------

  Future<void> startServer({int port = defaultPort, required String deviceName}) async {
    if (_isRunning) return;

    _error = null;
    _port = port;

    _server = P2PServer(deviceName: deviceName, port: port);

    _server!.onConnection = (connectionId, ip) {
      final connection = P2PConnection(
        id: connectionId,
        ip: ip,
        connectedAt: DateTime.now().millisecondsSinceEpoch,
      );
      _connections.add(connection);

      // Auto-select first connecting device
      _selectedDeviceId ??= connectionId;

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

  // --- Messaging ---

  /// Send a message to the currently selected client.
  bool sendToSelected(P2PMessage message) {
    if (_selectedDeviceId == null || _server == null) return false;
    return _server!.send(_selectedDeviceId!, message);
  }

  /// Send a message to a specific connection.
  bool sendTo(String connectionId, P2PMessage message) {
    return _server?.send(connectionId, message) ?? false;
  }

  /// Broadcast a message to all connected clients.
  void broadcast(P2PMessage message) {
    _server?.broadcast(message);
  }

  // --- Selection ---

  void selectDevice(String connectionId) {
    if (!_connections.any((c) => c.id == connectionId)) return;
    _selectedDeviceId = connectionId;
    notifyListeners();
  }

  // ---------------------------------------------------------------------------

  @override
  Future<void> dispose() async {
    await stopServer();
    await _messageController.close();
    super.dispose();
  }
}
