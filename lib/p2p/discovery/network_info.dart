import 'dart:io';

/// Resolves the device's local WiFi IP address.
/// Uses network_info_plus when available, falls back to dart:io lookup.
class NetworkInfo {
  /// Returns the local WiFi IP (e.g. '192.168.1.42').
  /// Returns null if the device is not connected to a network.
  static Future<String?> getLocalIp() async {
    try {
      // Try getting WiFi IP via network interfaces (works on Android without extra packages)
      final interfaces = await NetworkInterface.list(
        type: InternetAddressType.IPv4,
        includeLinkLocal: false,
      );

      for (final interface in interfaces) {
        // Skip loopback
        if (interface.name.toLowerCase().contains('lo')) continue;

        for (final addr in interface.addresses) {
          final ip = addr.address;
          // Must be a private range address
          if (_isPrivate(ip)) return ip;
        }
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  static bool _isPrivate(String ip) {
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('172.')) {
      final second = int.tryParse(ip.split('.')[1]) ?? 0;
      return second >= 16 && second <= 31;
    }
    return false;
  }
}
