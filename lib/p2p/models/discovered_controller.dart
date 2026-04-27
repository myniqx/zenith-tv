/// A P2P server discovered via HTTP subnet scan.
/// Mirrors: shared/content/src/utils/httpDiscovery.ts → DiscoveredController
class DiscoveredController {
  final String deviceId;
  final String deviceName;
  final String ip;
  final int port;
  final String version;

  const DiscoveredController({
    required this.deviceId,
    required this.deviceName,
    required this.ip,
    required this.port,
    required this.version,
  });

  factory DiscoveredController.fromJson(Map<String, dynamic> json, String ip) {
    return DiscoveredController(
      deviceId: json['deviceId'] as String,
      deviceName: json['deviceName'] as String,
      ip: ip,
      port: (json['port'] as num?)?.toInt() ?? 8080,
      version: (json['version'] as String?) ?? '1.0.0',
    );
  }

  Map<String, dynamic> toJson() => {
        'deviceId': deviceId,
        'deviceName': deviceName,
        'ip': ip,
        'port': port,
        'version': version,
      };

  @override
  bool operator ==(Object other) =>
      other is DiscoveredController && other.deviceId == deviceId;

  @override
  int get hashCode => deviceId.hashCode;
}
