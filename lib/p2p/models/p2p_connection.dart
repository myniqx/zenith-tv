enum HandshakeStatus { pending, completed, timedOut }

/// An active WebSocket connection to this server (server mode only).
class P2PConnection {
  final String id;
  final String ip;
  final String? deviceId;
  final String? deviceName;
  final int connectedAt;
  final HandshakeStatus handshake;

  const P2PConnection({
    required this.id,
    required this.ip,
    required this.connectedAt,
    this.deviceId,
    this.deviceName,
    this.handshake = HandshakeStatus.pending,
  });

  P2PConnection copyWith({
    String? deviceId,
    String? deviceName,
    HandshakeStatus? handshake,
  }) {
    return P2PConnection(
      id: id,
      ip: ip,
      connectedAt: connectedAt,
      deviceId: deviceId ?? this.deviceId,
      deviceName: deviceName ?? this.deviceName,
      handshake: handshake ?? this.handshake,
    );
  }
}
