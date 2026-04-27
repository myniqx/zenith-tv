/// Generic P2P message envelope.
/// Mirrors: shared/content/src/types/p2p.ts → P2PMessage
class P2PMessage<T> {
  final String type;
  final T? payload;

  const P2PMessage({required this.type, this.payload});

  factory P2PMessage.fromJson(
    Map<String, dynamic> json,
    T? Function(Object?)? payloadFromJson,
  ) {
    return P2PMessage(
      type: json['type'] as String,
      payload: payloadFromJson != null ? payloadFromJson(json['payload']) : null,
    );
  }

  Map<String, dynamic> toJson([Object? Function(T)? payloadToJson]) {
    return {
      'type': type,
      if (payload != null)
        'payload': payloadToJson != null ? payloadToJson(payload as T) : payload,
    };
  }
}

/// All message type constants used in the P2P protocol.
/// Mirrors: shared/content/src/types/p2p.ts message types
abstract final class P2PMessageType {
  // Server → Player (commands)
  static const String open = 'open';
  static const String playback = 'playback';
  static const String audio = 'audio';
  static const String video = 'video';
  static const String subtitle = 'subtitle';
  static const String window = 'window';
  static const String shortcut = 'shortcut';

  // Player → Server (state)
  static const String clientEvent = 'client_event';

  // Server → Player (resync request)
  static const String stateRequest = 'state_request';

  // Bidirectional
  static const String profileSync = 'profile_sync';

  // Handshake (server→client then client→server)
  static const String handshakeRequest  = 'handshake_request';
  static const String handshakeResponse = 'handshake_response';
}
