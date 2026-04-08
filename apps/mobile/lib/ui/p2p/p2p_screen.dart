import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/device_type.dart';
import '../../p2p/client/p2p_client_store.dart';
import '../../p2p/client/p2p_client.dart';
import '../../p2p/client/trusted_server.dart';
import '../../p2p/models/discovered_controller.dart';
import '../../p2p/server/p2p_server_store.dart';

/// P2P management screen.
///
/// Phone   → server only (who is connected to me)
/// Tablet  → client (connect to desktop) + server status
/// TV      → client (connect to desktop/phone) + server status
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
    if (DeviceTypeDetector.isPhone) {
      return Consumer<P2PServerStore>(
        builder: (context, serverStore, child) =>
            _PhoneP2PScreen(serverStore: serverStore),
      );
    }

    return Consumer2<P2PClientStore, P2PServerStore>(
      builder: (context, clientStore, serverStore, child) => _ClientServerP2PScreen(
        clientStore: clientStore,
        serverStore: serverStore,
        manualIpController: _manualIpController,
        onConnectManual: () => _connectManual(clientStore),
        isTV: DeviceTypeDetector.isTV,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Phone — server only view
// Shows who is connected to this phone, server start/stop
// ---------------------------------------------------------------------------

class _PhoneP2PScreen extends StatelessWidget {
  final P2PServerStore serverStore;

  const _PhoneP2PScreen({required this.serverStore});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        title: const Text('P2P', style: TextStyle(color: Color(0xFFEF4444))),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _ServerStatusCard(serverStore: serverStore),
            const SizedBox(height: 16),
            _ConnectedDevicesCard(serverStore: serverStore),
          ],
        ),
      ),
    );
  }
}

class _ServerStatusCard extends StatelessWidget {
  final P2PServerStore serverStore;
  const _ServerStatusCard({required this.serverStore});

  @override
  Widget build(BuildContext context) {
    final running = serverStore.isRunning;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: running ? Colors.green : Colors.grey,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 10),
              Text(
                running ? 'Server running on port ${serverStore.port}' : 'Server stopped',
                style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          if (serverStore.error != null) ...[
            const SizedBox(height: 8),
            Text(serverStore.error!,
                style: TextStyle(color: Colors.red.shade400, fontSize: 13)),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: running
                  ? serverStore.stopServer
                  : () => serverStore.startServer(deviceName: 'Zenith Phone'),
              style: ElevatedButton.styleFrom(
                backgroundColor: running ? Colors.red.shade800 : Colors.green.shade800,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: Text(running ? 'Stop Server' : 'Start Server'),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConnectedDevicesCard extends StatelessWidget {
  final P2PServerStore serverStore;
  const _ConnectedDevicesCard({required this.serverStore});

  @override
  Widget build(BuildContext context) {
    final connections = serverStore.connections;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Connected Devices (${connections.length})',
            style: const TextStyle(
                color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          if (connections.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  'No devices connected.\nTV or tablet will appear here when connected.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 14, height: 1.6),
                ),
              ),
            )
          else
            ...connections.map((c) {
              final isSelected = serverStore.selectedDeviceId == c.id;
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF1E3A5F) : const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(8),
                  border: isSelected
                      ? Border.all(color: Colors.blue.shade700)
                      : null,
                ),
                child: Row(
                  children: [
                    const Icon(Icons.tv, color: Color(0xFF94A3B8), size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(c.deviceName ?? c.ip,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                          Text(c.ip,
                              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                        ],
                      ),
                    ),
                    if (isSelected)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade900,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text('Active',
                            style: TextStyle(color: Colors.blue, fontSize: 11)),
                      )
                    else
                      TextButton(
                        onPressed: () => serverStore.selectDevice(c.id),
                        child: const Text('Set Active'),
                      ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tablet / TV — client connect + server status
// ---------------------------------------------------------------------------

class _ClientServerP2PScreen extends StatelessWidget {
  final P2PClientStore clientStore;
  final P2PServerStore serverStore;
  final TextEditingController manualIpController;
  final VoidCallback onConnectManual;
  final bool isTV;

  const _ClientServerP2PScreen({
    required this.clientStore,
    required this.serverStore,
    required this.manualIpController,
    required this.onConnectManual,
    this.isTV = false,
  });

  @override
  Widget build(BuildContext context) {
    final body = isTV
        ? _buildTVBody()
        : SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(children: _buildPanels()),
          );

    if (isTV) {
      return Scaffold(backgroundColor: const Color(0xFF0F172A), body: body);
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        title: const Text('P2P', style: TextStyle(color: Color(0xFFEF4444))),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: body,
    );
  }

  Widget _buildTVBody() {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 340,
            child: Column(children: [
              _ClientStatusCard(store: clientStore, isTV: true),
              const SizedBox(height: 16),
              _ManualConnectCard(
                controller: manualIpController,
                onConnect: onConnectManual,
              ),
            ]),
          ),
          const SizedBox(width: 24),
          Expanded(
            child: _DiscoveredServersCard(store: clientStore, isTV: true),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildPanels() {
    return [
      _ClientStatusCard(store: clientStore),
      const SizedBox(height: 16),
      _ManualConnectCard(
          controller: manualIpController, onConnect: onConnectManual),
      const SizedBox(height: 16),
      _DiscoveredServersCard(store: clientStore),
    ];
  }
}

// ---------------------------------------------------------------------------
// Client status card
// ---------------------------------------------------------------------------

class _ClientStatusCard extends StatelessWidget {
  final P2PClientStore store;
  final bool isTV;

  const _ClientStatusCard({required this.store, this.isTV = false});

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
            ? '${current.deviceName} (${current.ip})'
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
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(label,
                style: TextStyle(
                    color: Colors.white, fontSize: isTV ? 16 : 14)),
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
// Manual connect card
// ---------------------------------------------------------------------------

class _ManualConnectCard extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onConnect;

  const _ManualConnectCard({required this.controller, required this.onConnect});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Manual Connect',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
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
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            ),
            keyboardType: TextInputType.number,
            onSubmitted: (_) => onConnect(),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onConnect,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue.shade700,
                foregroundColor: Colors.white,
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
// Discovered + trusted servers list
// ---------------------------------------------------------------------------

class _DiscoveredServersCard extends StatelessWidget {
  final P2PClientStore store;
  final bool isTV;

  const _DiscoveredServersCard({required this.store, this.isTV = false});

  @override
  Widget build(BuildContext context) {
    final allServers = [
      ...store.trustedServers,
      ...store.discoveredServers.where(
          (d) => !store.trustedServers.any((t) => t.deviceId == d.deviceId)),
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Devices',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: isTV ? 18 : 15,
                      fontWeight: FontWeight.bold)),
              ElevatedButton.icon(
                onPressed: store.isScanning ? null : store.scan,
                icon: store.isScanning
                    ? const SizedBox(
                        width: 13,
                        height: 13,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.refresh, size: 15),
                label: Text(store.isScanning ? 'Scanning...' : 'Scan'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF334155),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (allServers.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  'No devices found.\nMake sure the app is running on another device.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: Colors.grey.shade600, fontSize: 13, height: 1.6),
                ),
              ),
            )
          else
            ...allServers.map((s) => _ServerTile(server: s, store: store, isTV: isTV)),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Server tile (trusted or discovered)
// ---------------------------------------------------------------------------

class _ServerTile extends StatelessWidget {
  final dynamic server;
  final P2PClientStore store;
  final bool isTV;

  const _ServerTile({required this.server, required this.store, this.isTV = false});

  String get _id => server is TrustedServer
      ? server.deviceId
      : (server as DiscoveredController).deviceId;
  String get _name => server is TrustedServer
      ? server.deviceName
      : (server as DiscoveredController).deviceName;
  String get _ip => server is TrustedServer
      ? server.ip
      : (server as DiscoveredController).ip;
  int get _port => server is TrustedServer
      ? server.port
      : (server as DiscoveredController).port;

  void _connect() {
    if (server is TrustedServer) {
      store.connectToTrusted(server as TrustedServer);
    } else {
      store.connect(server as DiscoveredController);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isTrusted = store.trustedServers.any((t) => t.deviceId == _id);
    final trusted = store.trustedServers.where((t) => t.deviceId == _id).firstOrNull;
    final isConnected = store.currentServer?.deviceId == _id;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isConnected ? const Color(0xFF1E3A5F) : const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(8),
        border: isConnected
            ? Border.all(color: Colors.blue.shade700)
            : null,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_name,
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: isTV ? 18 : 14,
                        fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text('$_ip:$_port',
                    style: const TextStyle(
                        color: Color(0xFF94A3B8), fontSize: 12)),
                if (isTrusted)
                  Container(
                    margin: const EdgeInsets.only(top: 3),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(
                      color: const Color(0xFF14532D),
                      borderRadius: BorderRadius.circular(3),
                    ),
                    child: const Text('Saved',
                        style: TextStyle(color: Color(0xFF86EFAC), fontSize: 10)),
                  ),
              ],
            ),
          ),
          if (isTrusted && trusted != null)
            GestureDetector(
              onTap: () => store.updateTrustedServer(_id,
                  autoConnect: !trusted.autoConnect),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: trusted.autoConnect
                      ? Colors.blue.shade900
                      : const Color(0xFF334155),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  'Auto',
                  style: TextStyle(
                      color: trusted.autoConnect
                          ? Colors.blue.shade200
                          : Colors.grey,
                      fontSize: 11),
                ),
              ),
            ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: isConnected ? null : _connect,
            style: ElevatedButton.styleFrom(
              backgroundColor:
                  isConnected ? Colors.grey.shade800 : Colors.red.shade700,
              foregroundColor: Colors.white,
              padding: EdgeInsets.symmetric(
                  horizontal: isTV ? 20 : 12,
                  vertical: isTV ? 12 : 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(isConnected ? 'Connected' : 'Connect',
                style: TextStyle(fontSize: isTV ? 14 : 12)),
          ),
          if (isTrusted)
            IconButton(
              onPressed: () => store.removeTrustedServer(_id),
              icon: const Icon(Icons.close, size: 16),
              color: Colors.grey,
              padding: const EdgeInsets.all(4),
              constraints: const BoxConstraints(),
            ),
        ],
      ),
    );
  }
}
