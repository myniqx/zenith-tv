import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/device_type.dart';
import '../../p2p/client/p2p_client_store.dart';
import '../../p2p/client/p2p_client.dart';
import '../../p2p/client/trusted_server.dart';
import '../../p2p/models/discovered_controller.dart';

/// P2P connection management screen.
/// Mirrors: apps/tizen/src/components/P2P/P2PView.tsx
class P2PScreen extends StatefulWidget {
  const P2PScreen({super.key});

  @override
  State<P2PScreen> createState() => _P2PScreenState();
}

class _P2PScreenState extends State<P2PScreen> {
  final _manualIpController = TextEditingController();

  @override
  void dispose() {
    _manualIpController.dispose();
    super.dispose();
  }

  void _connectManual(P2PClientStore store) {
    final ip = _manualIpController.text.trim();
    if (ip.isEmpty) return;
    store.connect(DiscoveredController(
      deviceId: 'manual-$ip',
      deviceName: 'Manual ($ip)',
      ip: ip,
      port: 8080,
      version: '1.0.0',
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<P2PClientStore>(
      builder: (context, store, _) {
        if (DeviceTypeDetector.isTV) {
          return _TVLayout(
            store: store,
            manualIpController: _manualIpController,
            onConnectManual: () => _connectManual(store),
          );
        }

        return _TouchLayout(
          store: store,
          manualIpController: _manualIpController,
          onConnectManual: () => _connectManual(store),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Status indicator
// ---------------------------------------------------------------------------

class _StatusBar extends StatelessWidget {
  final P2PClientStore store;

  const _StatusBar({required this.store});

  @override
  Widget build(BuildContext context) {
    final status = store.connectionStatus;
    final current = store.currentServer;

    Color dotColor;
    String label;

    switch (status) {
      case P2PConnectionStatus.connected:
        dotColor = Colors.green;
        label = current != null
            ? 'Connected: ${current.deviceName} (${current.ip})'
            : 'Connected';
        break;
      case P2PConnectionStatus.connecting:
        dotColor = Colors.amber;
        label = 'Connecting...';
        break;
      case P2PConnectionStatus.error:
        dotColor = Colors.orange;
        label = store.error ?? 'Connection error';
        break;
      default:
        dotColor = Colors.red;
        label = 'Not connected';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Container(
            width: 14,
            height: 14,
            decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(label,
                style: const TextStyle(color: Colors.white, fontSize: 16)),
          ),
          if (status == P2PConnectionStatus.connected)
            TextButton(
              onPressed: store.disconnect,
              style: TextButton.styleFrom(foregroundColor: Colors.red),
              child: const Text('Disconnect'),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Server list item
// ---------------------------------------------------------------------------

class _ServerTile extends StatelessWidget {
  final dynamic server; // DiscoveredController or TrustedServer
  final P2PClientStore store;
  final bool isTV;

  const _ServerTile({
    required this.server,
    required this.store,
    this.isTV = false,
  });

  String get _deviceId =>
      server is TrustedServer ? server.deviceId : (server as DiscoveredController).deviceId;
  String get _deviceName =>
      server is TrustedServer ? server.deviceName : (server as DiscoveredController).deviceName;
  String get _ip =>
      server is TrustedServer ? server.ip : (server as DiscoveredController).ip;
  int get _port =>
      server is TrustedServer ? server.port : (server as DiscoveredController).port;

  void _connect(P2PClientStore store) {
    if (server is TrustedServer) {
      store.connectToTrusted(server as TrustedServer);
    } else {
      store.connect(server as DiscoveredController);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isTrusted = store.trustedServers.any((t) => t.deviceId == _deviceId);
    final trustedData =
        store.trustedServers.where((t) => t.deviceId == _deviceId).firstOrNull;
    final isConnected = store.currentServer?.deviceId == _deviceId;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isConnected ? const Color(0xFF1E3A5F) : const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(8),
        border: isConnected
            ? Border.all(color: Colors.blue.shade700, width: 1.5)
            : null,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_deviceName,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: isTV ? 20 : 16,
                      fontWeight: FontWeight.bold,
                    )),
                const SizedBox(height: 4),
                Text('$_ip:$_port',
                    style: const TextStyle(
                        color: Color(0xFF94A3B8), fontSize: 13)),
                if (isTrusted)
                  Container(
                    margin: const EdgeInsets.only(top: 4),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF14532D),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text('Saved',
                        style:
                            TextStyle(color: Color(0xFF86EFAC), fontSize: 11)),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (isTrusted && trustedData != null)
            TextButton(
              onPressed: () => store.updateTrustedServer(_deviceId,
                  autoConnect: !trustedData.autoConnect),
              style: TextButton.styleFrom(
                foregroundColor: trustedData.autoConnect
                    ? Colors.blue.shade300
                    : Colors.grey,
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              ),
              child: Text(
                  'Auto: ${trustedData.autoConnect ? "On" : "Off"}',
                  style: const TextStyle(fontSize: 12)),
            ),
          ElevatedButton(
            onPressed: isConnected ? null : () => _connect(store),
            style: ElevatedButton.styleFrom(
              backgroundColor:
                  isConnected ? Colors.grey.shade800 : Colors.red.shade700,
              foregroundColor: Colors.white,
              padding: EdgeInsets.symmetric(
                  horizontal: isTV ? 24 : 16, vertical: isTV ? 14 : 10),
            ),
            child: Text(isConnected ? 'Connected' : 'Connect'),
          ),
          if (isTrusted)
            IconButton(
              onPressed: () => store.removeTrustedServer(_deviceId),
              icon: const Icon(Icons.close, size: 18),
              color: Colors.grey,
              tooltip: 'Forget',
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Manual connect panel
// ---------------------------------------------------------------------------

class _ManualConnectPanel extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onConnect;

  const _ManualConnectPanel(
      {required this.controller, required this.onConnect});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Manual Connect',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          const Text('IP Address',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
          const SizedBox(height: 6),
          TextField(
            controller: controller,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: '192.168.1.X',
              hintStyle: const TextStyle(color: Color(0xFF475569)),
              filled: true,
              fillColor: const Color(0xFF334155),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: BorderSide.none,
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            keyboardType: TextInputType.number,
            onSubmitted: (_) => onConnect(),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onConnect,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue.shade700,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: const Text('Connect'),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Server list panel
// ---------------------------------------------------------------------------

class _ServerListPanel extends StatelessWidget {
  final P2PClientStore store;
  final bool isTV;

  const _ServerListPanel({required this.store, this.isTV = false});

  @override
  Widget build(BuildContext context) {
    final allServers = [
      ...store.trustedServers,
      ...store.discoveredServers.where(
          (d) => !store.trustedServers.any((t) => t.deviceId == d.deviceId)),
    ];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Discovered Devices',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: isTV ? 20 : 18,
                      fontWeight: FontWeight.bold)),
              ElevatedButton.icon(
                onPressed: store.isScanning ? null : store.scan,
                icon: store.isScanning
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.refresh, size: 16),
                label: Text(store.isScanning ? 'Scanning...' : 'Scan'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF334155),
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (allServers.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: Center(
                child: Text(
                  'No devices found.\nMake sure the Desktop app is running.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: Colors.grey.shade600, fontSize: 14, height: 1.6),
                ),
              ),
            )
          else
            ...allServers.map((s) =>
                _ServerTile(server: s, store: store, isTV: isTV)),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// TV layout (side-by-side panels)
// ---------------------------------------------------------------------------

class _TVLayout extends StatelessWidget {
  final P2PClientStore store;
  final TextEditingController manualIpController;
  final VoidCallback onConnectManual;

  const _TVLayout({
    required this.store,
    required this.manualIpController,
    required this.onConnectManual,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('P2P Remote Control',
                style: TextStyle(
                    color: Color(0xFFEF4444),
                    fontSize: 32,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 24),
            _StatusBar(store: store),
            const SizedBox(height: 24),
            Expanded(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 320,
                    child: _ManualConnectPanel(
                      controller: manualIpController,
                      onConnect: onConnectManual,
                    ),
                  ),
                  const SizedBox(width: 24),
                  Expanded(
                    child: _ServerListPanel(store: store, isTV: true),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Touch layout (scrollable column)
// ---------------------------------------------------------------------------

class _TouchLayout extends StatelessWidget {
  final P2PClientStore store;
  final TextEditingController manualIpController;
  final VoidCallback onConnectManual;

  const _TouchLayout({
    required this.store,
    required this.manualIpController,
    required this.onConnectManual,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        title: const Text('P2P Remote Control',
            style: TextStyle(color: Color(0xFFEF4444))),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _StatusBar(store: store),
            const SizedBox(height: 16),
            _ManualConnectPanel(
              controller: manualIpController,
              onConnect: onConnectManual,
            ),
            const SizedBox(height: 16),
            _ServerListPanel(store: store),
          ],
        ),
      ),
    );
  }
}
