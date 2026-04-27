import 'dart:async';
import 'dart:convert';
import 'dart:isolate';
import 'package:http/http.dart' as http;
import '../models/index.dart';

/// Scans the local /24 subnet for Zenith TV desktop servers.
/// Mirrors: shared/content/src/utils/httpDiscovery.ts → HTTPDiscoveryService
class HttpDiscoveryService {
  static const int _defaultPort = 8080;
  static const Duration _hostTimeout = Duration(milliseconds: 300);

  bool _isScanning = false;
  Isolate? _isolate;
  ReceivePort? _receivePort;

  bool get isScanning => _isScanning;

  /// Scans the subnet derived from [localIp] and returns discovered controllers.
  /// Runs in a separate Isolate to avoid blocking the UI thread.
  Future<List<DiscoveredController>> scan(String localIp) async {
    if (_isScanning) return [];

    _isScanning = true;

    try {
      final subnet = _subnetOf(localIp);
      final results = await _scanInIsolate(subnet, _defaultPort);
      return results;
    } finally {
      _isScanning = false;
    }
  }

  /// Cancels an in-progress scan.
  void stopScan() {
    _isolate?.kill(priority: Isolate.immediate);
    _isolate = null;
    _receivePort?.close();
    _receivePort = null;
    _isScanning = false;
  }

  // ---------------------------------------------------------------------------

  String _subnetOf(String ip) {
    final parts = ip.split('.');
    return '${parts[0]}.${parts[1]}.${parts[2]}';
  }

  Future<List<DiscoveredController>> _scanInIsolate(
      String subnet, int port) async {
    final receivePort = ReceivePort();
    _receivePort = receivePort;

    final completer = Completer<List<DiscoveredController>>();

    _isolate = await Isolate.spawn(
      _scanWorker,
      _ScanParams(
        sendPort: receivePort.sendPort,
        subnet: subnet,
        port: port,
      ),
    );

    receivePort.listen((message) {
      if (message is List<Map<String, dynamic>>) {
        final controllers = message
            .map((json) => DiscoveredController.fromJson(json, json['ip'] as String))
            .toList();
        completer.complete(controllers);
        receivePort.close();
      }
    });

    return completer.future;
  }

  /// Isolate entry point — runs outside the main thread.
  static Future<void> _scanWorker(_ScanParams params) async {
    final futures = <Future<Map<String, dynamic>?>>[];

    for (int i = 1; i <= 254; i++) {
      final ip = '${params.subnet}.$i';
      futures.add(_checkHost(ip, params.port));
    }

    final results = await Future.wait(futures);
    final found = results
        .whereType<Map<String, dynamic>>()
        .toList();

    params.sendPort.send(found);
  }

  static Future<Map<String, dynamic>?> _checkHost(String ip, int port) async {
    try {
      final uri = Uri.parse('http://$ip:$port/api/discover');
      final response = await http
          .get(uri, headers: {'Accept': 'application/json'})
          .timeout(_hostTimeout);

      if (response.statusCode != 200) return null;

      final data = jsonDecode(response.body) as Map<String, dynamic>;

      if (data['role'] != 'controller') return null;

      return {
        ...data,
        'ip': ip,
      };
    } catch (_) {
      // Timeout or connection refused — expected during scan
      return null;
    }
  }
}

/// Parameters passed to the scan Isolate.
class _ScanParams {
  final SendPort sendPort;
  final String subnet;
  final int port;

  const _ScanParams({
    required this.sendPort,
    required this.subnet,
    required this.port,
  });
}
