/// An active WebSocket connection to this server (server mode only).
/// Mirrors: shared/content/src/types/p2p.ts → P2PConnection
class P2PConnection {
  final String id;
  final String ip;
  final String? deviceName;
  final int connectedAt;

  const P2PConnection({
    required this.id,
    required this.ip,
    required this.connectedAt,
    this.deviceName,
  });

  P2PConnection copyWith({String? deviceName}) {
    return P2PConnection(
      id: id,
      ip: ip,
      connectedAt: connectedAt,
      deviceName: deviceName ?? this.deviceName,
    );
  }
}
