import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/index.dart';

enum P2PConnectionStatus { disconnected, connecting, connected, error }

/// Low-level WebSocket client.
/// Manages a single connection to a Zenith TV desktop server.
/// Mirrors: apps/tizen/src/stores/p2pClientStore.ts → connect / disconnect / sendMessage
class P2PClient {
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;

  final _statusController =
      StreamController<P2PConnectionStatus>.broadcast();
  final _messageController =
      StreamController<Map<String, dynamic>>.broadcast();

  P2PConnectionStatus _status = P2PConnectionStatus.disconnected;

  /// Current connection status.
  P2PConnectionStatus get status => _status;

  /// Stream of connection status changes.
  Stream<P2PConnectionStatus> get statusStream => _statusController.stream;

  /// Stream of raw incoming messages (decoded JSON maps).
  Stream<Map<String, dynamic>> get messageStream => _messageController.stream;

  /// Connect to a server at [ip]:[port].
  Future<void> connect(String ip, int port) async {
    if (_status == P2PConnectionStatus.connected ||
        _status == P2PConnectionStatus.connecting) {
      await disconnect();
    }

    _setStatus(P2PConnectionStatus.connecting);

    final uri = Uri.parse('ws://$ip:$port');

    try {
      _channel = WebSocketChannel.connect(uri);

      // Wait for the handshake to complete
      await _channel!.ready;

      _setStatus(P2PConnectionStatus.connected);

      _subscription = _channel!.stream.listen(
        _onData,
        onError: _onError,
        onDone: _onDone,
        cancelOnError: false,
      );
    } catch (e) {
      _setStatus(P2PConnectionStatus.error);
      rethrow;
    }
  }

  /// Disconnect from the current server.
  Future<void> disconnect() async {
    await _subscription?.cancel();
    _subscription = null;
    await _channel?.sink.close();
    _channel = null;
    _setStatus(P2PConnectionStatus.disconnected);
  }

  /// Send a [P2PMessage] to the connected server.
  /// No-op if not connected.
  void sendMessage(P2PMessage message) {
    if (_status != P2PConnectionStatus.connected || _channel == null) return;
    final json = jsonEncode(message.toJson());
    _channel!.sink.add(json);
  }

  /// Send a raw typed message without needing a P2PMessage wrapper.
  void sendRaw(String type, [Object? payload]) {
    sendMessage(P2PMessage(type: type, payload: payload));
  }

  Future<void> dispose() async {
    await disconnect();
    await _statusController.close();
    await _messageController.close();
  }

  // ---------------------------------------------------------------------------

  void _onData(dynamic data) {
    try {
      final decoded = jsonDecode(data as String) as Map<String, dynamic>;
      _messageController.add(decoded);
    } catch (_) {
      // Ignore malformed messages
    }
  }

  void _onError(Object error) {
    _setStatus(P2PConnectionStatus.error);
  }

  void _onDone() {
    _setStatus(P2PConnectionStatus.disconnected);
  }

  void _setStatus(P2PConnectionStatus status) {
    if (_status == status) return;
    _status = status;
    _statusController.add(status);
  }
}
