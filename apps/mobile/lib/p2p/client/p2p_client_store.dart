import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/index.dart';
import '../discovery/http_discovery_service.dart';
import '../discovery/network_info.dart';
import 'p2p_client.dart';
import 'trusted_server.dart';

/// High-level P2P client state manager.
/// Handles discovery, connection lifecycle, trusted servers, and auto-connect.
/// Mirrors: apps/tizen/src/stores/p2pClientStore.ts
class P2PClientStore extends ChangeNotifier {
  static const String _prefsKey = 'zenith_p2p_client';

  final P2PClient _client = P2PClient();
  final HttpDiscoveryService _discovery = HttpDiscoveryService();

  // --- State ---
  P2PConnectionStatus _connectionStatus = P2PConnectionStatus.disconnected;
  TrustedServer? _currentServer;
  List<TrustedServer> _trustedServers = [];
  List<DiscoveredController> _discoveredServers = [];
  bool _isScanning = false;
  bool _autoConnect = true;
  Map<String, dynamic>? _lastReceivedMessage;
  String? _error;

  // --- Getters ---
  P2PConnectionStatus get connectionStatus => _connectionStatus;
  TrustedServer? get currentServer => _currentServer;
  List<TrustedServer> get trustedServers => List.unmodifiable(_trustedServers);
  List<DiscoveredController> get discoveredServers =>
      List.unmodifiable(_discoveredServers);
  bool get isScanning => _isScanning;
  bool get autoConnect => _autoConnect;
  Map<String, dynamic>? get lastReceivedMessage => _lastReceivedMessage;
  String? get error => _error;
  bool get isConnected => _connectionStatus == P2PConnectionStatus.connected;

  /// Raw message stream — P2PManager listens to this.
  Stream<Map<String, dynamic>> get messageStream => _client.messageStream;

  // ---------------------------------------------------------------------------

  Future<void> init() async {
    await _loadFromPrefs();

    // Mirror client status into local state
    _client.statusStream.listen((status) {
      _connectionStatus = status;
      if (status == P2PConnectionStatus.disconnected ||
          status == P2PConnectionStatus.error) {
        _currentServer = null;
      }
      notifyListeners();
    });

    // Keep lastReceivedMessage updated for simple observers
    _client.messageStream.listen((msg) {
      _lastReceivedMessage = msg;
      notifyListeners();
    });

    if (_autoConnect) {
      await scan();
    }
  }

  // --- Discovery ---

  Future<void> scan() async {
    if (_isScanning) return;

    _isScanning = true;
    _error = null;
    notifyListeners();

    try {
      final localIp = await NetworkInfo.getLocalIp();
      if (localIp == null) {
        _error = 'Could not determine local IP';
        return;
      }

      final servers = await _discovery.scan(localIp);
      _discoveredServers = servers;

      // Auto-connect to first trusted server with autoConnect enabled
      if (_autoConnect &&
          _connectionStatus == P2PConnectionStatus.disconnected) {
        for (final discovered in servers) {
          final trusted = _trustedServers
              .where((t) =>
                  t.deviceId == discovered.deviceId && t.autoConnect)
              .firstOrNull;
          if (trusted != null) {
            await connect(discovered);
            break;
          }
        }
      }
    } catch (e) {
      _error = 'Scan failed: $e';
    } finally {
      _isScanning = false;
      notifyListeners();
    }
  }

  // --- Connection ---

  Future<void> connect(DiscoveredController server) async {
    _error = null;

    try {
      await _client.connect(server.ip, server.port);
      _addOrUpdateTrustedServer(server);
      _currentServer = _trustedServers
          .firstWhere((t) => t.deviceId == server.deviceId);
      await _saveToPrefs();
      notifyListeners();
    } catch (e) {
      _error = 'Connection failed: $e';
      notifyListeners();
    }
  }

  Future<void> connectToTrusted(TrustedServer trusted) async {
    await connect(trusted.toDiscovered());
  }

  Future<void> disconnect() async {
    await _client.disconnect();
    _currentServer = null;
    notifyListeners();
  }

  // --- Messaging ---

  void sendMessage(P2PMessage message) {
    _client.sendMessage(message);
  }

  void sendRaw(String type, [Object? payload]) {
    _client.sendRaw(type, payload);
  }

  // --- Trusted server management ---

  void setAutoConnect(bool enabled) {
    _autoConnect = enabled;
    _saveToPrefs();
    notifyListeners();
  }

  void updateTrustedServer(String deviceId, {bool? autoConnect}) {
    _trustedServers = _trustedServers.map((s) {
      if (s.deviceId != deviceId) return s;
      return s.copyWith(autoConnect: autoConnect);
    }).toList();
    _saveToPrefs();
    notifyListeners();
  }

  void removeTrustedServer(String deviceId) {
    _trustedServers.removeWhere((s) => s.deviceId == deviceId);
    _saveToPrefs();
    notifyListeners();
  }

  // --- Persistence ---

  Future<void> _loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw == null) return;

    try {
      final data = jsonDecode(raw) as Map<String, dynamic>;
      _autoConnect = (data['autoConnect'] as bool?) ?? true;
      final servers = data['trustedServers'] as List<dynamic>? ?? [];
      _trustedServers = servers
          .map((e) => TrustedServer.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      // Corrupt prefs — start fresh
    }
  }

  Future<void> _saveToPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final data = {
      'autoConnect': _autoConnect,
      'trustedServers': _trustedServers.map((s) => s.toJson()).toList(),
    };
    await prefs.setString(_prefsKey, jsonEncode(data));
  }

  // --- Internal ---

  void _addOrUpdateTrustedServer(DiscoveredController discovered) {
    // Match by deviceId first, then fall back to ip (covers manual entries)
    var index = _trustedServers.indexWhere((t) => t.deviceId == discovered.deviceId);
    if (index < 0) {
      index = _trustedServers.indexWhere((t) => t.ip == discovered.ip);
    }

    if (index >= 0) {
      _trustedServers[index] = _trustedServers[index].copyWith(
        deviceId: discovered.deviceId,
        deviceName: discovered.deviceName,
        ip: discovered.ip,
        lastConnectedAt: DateTime.now().millisecondsSinceEpoch,
      );
    } else {
      _trustedServers.add(TrustedServer.fromDiscovered(discovered));
    }
  }

  @override
  Future<void> dispose() async {
    await _client.dispose();
    super.dispose();
  }
}
