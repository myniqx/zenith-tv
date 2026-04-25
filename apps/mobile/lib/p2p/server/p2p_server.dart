import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_web_socket/shelf_web_socket.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/index.dart';

typedef ConnectionCallback = void Function(String connectionId, String ip);
typedef MessageCallback = void Function(String connectionId, Map<String, dynamic> message);
typedef DisconnectionCallback = void Function(String connectionId);

/// HTTP + WebSocket server on a single port.
/// Exposes /api/discover for HTTP discovery and accepts WebSocket connections.
/// On each new connection sends a handshake_request; if no handshake_response
/// arrives within [_handshakeTimeout] the connection is forcibly closed.
class P2PServer {
  static const Duration _handshakeTimeout = Duration(seconds: 15);

  final String deviceId;
  final String deviceName;
  final int port;

  HttpServer? _httpServer;
  final Map<String, WebSocketChannel> _clients = {};
  final Map<String, Timer> _handshakeTimers = {};

  ConnectionCallback? onConnection;
  MessageCallback? onMessage;
  DisconnectionCallback? onDisconnection;

  P2PServer({
    required this.deviceName,
    this.port = 8080,
  }) : deviceId = _generateDeviceId();

  bool get isRunning => _httpServer != null;
  int get clientCount => _clients.length;
  List<String> get connectionIds => List.unmodifiable(_clients.keys);

  // ---------------------------------------------------------------------------

  Future<void> start() async {
    if (isRunning) return;

    final handler = const Pipeline()
        .addMiddleware(_corsMiddleware())
        .addHandler(_router);

    _httpServer = await shelf_io.serve(handler, InternetAddress.anyIPv4, port);
  }

  Future<void> stop() async {
    for (final t in _handshakeTimers.values) { t.cancel(); }
    _handshakeTimers.clear();
    for (final channel in _clients.values) { await channel.sink.close(); }
    _clients.clear();
    await _httpServer?.close(force: true);
    _httpServer = null;
  }

  // --- Messaging ---

  bool send(String connectionId, P2PMessage message) {
    final channel = _clients[connectionId];
    if (channel == null) return false;
    channel.sink.add(jsonEncode(message.toJson()));
    return true;
  }

  void broadcast(P2PMessage message) {
    final encoded = jsonEncode(message.toJson());
    for (final channel in _clients.values) {
      channel.sink.add(encoded);
    }
  }

  /// Called by P2PManager when handshake_response is validated —
  /// cancels the timeout timer for this connection.
  void handshakeCompleted(String connectionId) {
    _handshakeTimers.remove(connectionId)?.cancel();
  }

  /// Forcibly close a connection (e.g. handshake timeout or trust denied).
  Future<void> closeConnection(String connectionId) async {
    _handshakeTimers.remove(connectionId)?.cancel();
    final channel = _clients.remove(connectionId);
    await channel?.sink.close();
    onDisconnection?.call(connectionId);
  }

  // ---------------------------------------------------------------------------

  Handler get _router => (Request request) async {
        final wsHandler = webSocketHandler(_handleWebSocket);
        final wsResponse = await wsHandler(request);
        if (wsResponse.statusCode != 404) return wsResponse;

        if (request.method == 'GET' && request.url.path == 'api/discover') {
          return _discoverResponse();
        }

        return Response.notFound('Not Found');
      };

  Response _discoverResponse() {
    final body = jsonEncode({
      'deviceId': deviceId,
      'deviceName': deviceName,
      'port': port,
      'version': '1.0.0',
      'role': 'controller',
    });
    return Response.ok(body, headers: {'Content-Type': 'application/json'});
  }

  void _handleWebSocket(WebSocketChannel channel, String? protocol) {
    final connectionId = _randomId();
    _clients[connectionId] = channel;

    onConnection?.call(connectionId, 'unknown');

    // Send handshake request immediately
    channel.sink.add(jsonEncode(
      P2PMessage(type: P2PMessageType.handshakeRequest).toJson(),
    ));

    // Start 15s timeout — close if no handshake_response arrives
    _handshakeTimers[connectionId] = Timer(_handshakeTimeout, () {
      _handshakeTimers.remove(connectionId);
      closeConnection(connectionId);
    });

    channel.stream.listen(
      (data) {
        try {
          final message = jsonDecode(data as String) as Map<String, dynamic>;
          onMessage?.call(connectionId, message);
        } catch (_) {}
      },
      onDone: () {
        _handshakeTimers.remove(connectionId)?.cancel();
        _clients.remove(connectionId);
        onDisconnection?.call(connectionId);
      },
      onError: (_) {
        _handshakeTimers.remove(connectionId)?.cancel();
        _clients.remove(connectionId);
        onDisconnection?.call(connectionId);
      },
      cancelOnError: false,
    );
  }

  static Middleware _corsMiddleware() {
    return (Handler innerHandler) {
      return (Request request) async {
        if (request.method == 'OPTIONS') {
          return Response.ok('', headers: _corsHeaders);
        }
        final response = await innerHandler(request);
        return response.change(headers: _corsHeaders);
      };
    };
  }

  static const Map<String, String> _corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  static String _generateDeviceId() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  static String _randomId() {
    final random = Random.secure();
    final bytes = List<int>.generate(8, (_) => random.nextInt(256));
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }
}
