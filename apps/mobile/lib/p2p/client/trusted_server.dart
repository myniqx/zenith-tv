import '../models/discovered_controller.dart';

/// A server the user has previously connected to.
/// Mirrors: apps/tizen/src/stores/p2pClientStore.ts → TrustedServer
class TrustedServer {
  final String deviceId;
  final String deviceName;
  final String ip;
  final int port;
  final String version;
  final bool autoConnect;
  final int lastConnectedAt;

  const TrustedServer({
    required this.deviceId,
    required this.deviceName,
    required this.ip,
    required this.port,
    required this.version,
    required this.autoConnect,
    required this.lastConnectedAt,
  });

  factory TrustedServer.fromDiscovered(
    DiscoveredController controller, {
    bool autoConnect = true,
  }) {
    return TrustedServer(
      deviceId: controller.deviceId,
      deviceName: controller.deviceName,
      ip: controller.ip,
      port: controller.port,
      version: controller.version,
      autoConnect: autoConnect,
      lastConnectedAt: DateTime.now().millisecondsSinceEpoch,
    );
  }

  factory TrustedServer.fromJson(Map<String, dynamic> json) => TrustedServer(
        deviceId: json['deviceId'] as String,
        deviceName: json['deviceName'] as String,
        ip: json['ip'] as String,
        port: (json['port'] as num).toInt(),
        version: (json['version'] as String?) ?? '1.0.0',
        autoConnect: (json['autoConnect'] as bool?) ?? true,
        lastConnectedAt: (json['lastConnectedAt'] as num).toInt(),
      );

  Map<String, dynamic> toJson() => {
        'deviceId': deviceId,
        'deviceName': deviceName,
        'ip': ip,
        'port': port,
        'version': version,
        'autoConnect': autoConnect,
        'lastConnectedAt': lastConnectedAt,
      };

  TrustedServer copyWith({String? ip, bool? autoConnect, int? lastConnectedAt}) {
    return TrustedServer(
      deviceId: deviceId,
      deviceName: deviceName,
      ip: ip ?? this.ip,
      port: port,
      version: version,
      autoConnect: autoConnect ?? this.autoConnect,
      lastConnectedAt: lastConnectedAt ?? this.lastConnectedAt,
    );
  }

  DiscoveredController toDiscovered() => DiscoveredController(
        deviceId: deviceId,
        deviceName: deviceName,
        ip: ip,
        port: port,
        version: version,
      );
}
