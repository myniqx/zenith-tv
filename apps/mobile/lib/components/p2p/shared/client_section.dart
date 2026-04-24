import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../p2p/client/p2p_client_store.dart';
import '../../../p2p/client/p2p_client.dart';
import '../../../p2p/client/trusted_server.dart';
import '../../../p2p/models/discovered_controller.dart';

class ClientSection extends StatefulWidget {
  const ClientSection({super.key});

  @override
  State<ClientSection> createState() => _ClientSectionState();
}

class _ClientSectionState extends State<ClientSection> {
  final _manualIpController = TextEditingController();
  bool _showManual = false;

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
    final store = context.watch<P2PClientStore>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _StatusCard(store: store),
        const SizedBox(height: 16),
        _DiscoveredServersCard(store: store),
        const SizedBox(height: 16),
        _ManualConnectCard(
          controller: _manualIpController,
          expanded: _showManual,
          onToggle: () => setState(() => _showManual = !_showManual),
          onConnect: () => _connectManual(store),
          disabled: store.connectionStatus == P2PConnectionStatus.connected,
        ),
      ],
    );
  }
}

class _StatusCard extends StatelessWidget {
  final P2PClientStore store;
  const _StatusCard({required this.store});

  @override
  Widget build(BuildContext context) {
    final status  = store.connectionStatus;
    final current = store.currentServer;

    final (dotColor, label) = switch (status) {
      P2PConnectionStatus.connected  => (
          ZColors.successFg,
          current != null ? '${current.deviceName}  ·  ${current.ip}' : 'Connected',
        ),
      P2PConnectionStatus.connecting => (ZColors.warningFg, 'Connecting...'),
      P2PConnectionStatus.error      => (ZColors.warningFg, store.error ?? 'Connection error'),
      _                              => (ZColors.mutedForeground, 'Not connected'),
    };

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.15)),
      ),
      child: Row(
        children: [
          Container(
            width: 8, height: 8,
            decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(label, style: ZText.body(14))),
          if (status == P2PConnectionStatus.connected)
            TextButton(
              onPressed: store.disconnect,
              style: TextButton.styleFrom(foregroundColor: ZColors.destructiveFg),
              child: const Text('Disconnect'),
            ),
        ],
      ),
    );
  }
}

class _DiscoveredServersCard extends StatelessWidget {
  final P2PClientStore store;
  const _DiscoveredServersCard({required this.store});

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
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Available Controllers',
                    style: ZText.body(14, weight: FontWeight.w600)),
              ),
              // Auto-connect toggle
              Row(
                children: [
                  Text('Auto', style: ZText.body(12, color: ZColors.mutedForeground)),
                  const SizedBox(width: 6),
                  Switch(
                    value: store.autoConnect,
                    onChanged: store.setAutoConnect,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ],
              ),
              const SizedBox(width: 8),
              _ScanButton(store: store),
            ],
          ),
          const SizedBox(height: 12),
          if (allServers.isEmpty && !store.isScanning)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Center(
                child: Text(
                  'No controllers found.\nMake sure the other device is running Zenith TV.',
                  textAlign: TextAlign.center,
                  style: ZText.body(13, color: ZColors.mutedForeground),
                ),
              ),
            )
          else if (allServers.isEmpty && store.isScanning)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Center(child: CircularProgressIndicator()),
            )
          else
            ...allServers.map((s) => _ServerTile(server: s, store: store)),
        ],
      ),
    );
  }
}

class _ScanButton extends StatelessWidget {
  final P2PClientStore store;
  const _ScanButton({required this.store});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: store.isScanning ? null : store.scan,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: ZColors.muted,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (store.isScanning)
              const SizedBox(
                width: 12, height: 12,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else
              const Icon(Icons.refresh, size: 14, color: ZColors.mutedForeground),
            const SizedBox(width: 6),
            Text(
              store.isScanning ? 'Scanning...' : 'Scan',
              style: ZText.body(12, color: ZColors.mutedForeground),
            ),
          ],
        ),
      ),
    );
  }
}

class _ServerTile extends StatelessWidget {
  final dynamic server;
  final P2PClientStore store;
  const _ServerTile({required this.server, required this.store});

  String get _id   => server is TrustedServer ? server.deviceId  : (server as DiscoveredController).deviceId;
  String get _name => server is TrustedServer ? server.deviceName : (server as DiscoveredController).deviceName;
  String get _ip   => server is TrustedServer ? server.ip         : (server as DiscoveredController).ip;
  int    get _port => server is TrustedServer ? server.port       : (server as DiscoveredController).port;

  void _connect() {
    if (server is TrustedServer) {
      store.connectToTrusted(server as TrustedServer);
    } else {
      store.connect(server as DiscoveredController);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isTrusted   = store.trustedServers.any((t) => t.deviceId == _id);
    final trusted     = store.trustedServers.where((t) => t.deviceId == _id).firstOrNull;
    final isConnected = store.currentServer?.deviceId == _id;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isConnected ? ZColors.accent : ZColors.muted,
        borderRadius: BorderRadius.circular(10),
        border: isConnected ? Border.all(color: ZColors.primary.withValues(alpha: 0.4)) : null,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(_name, style: ZText.body(14, weight: FontWeight.w600)),
                    if (isTrusted) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: ZColors.success,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text('Trusted',
                            style: ZText.body(10, weight: FontWeight.w700, color: ZColors.successFg)),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text('$_ip:$_port', style: ZText.bodySm),
              ],
            ),
          ),
          if (isTrusted && trusted != null) ...[
            GestureDetector(
              onTap: () => store.updateTrustedServer(_id, autoConnect: !trusted.autoConnect),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: trusted.autoConnect ? ZColors.accent : ZColors.secondary,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text('Auto',
                    style: ZText.body(11, weight: FontWeight.w600,
                        color: trusted.autoConnect ? ZColors.primary : ZColors.mutedForeground)),
              ),
            ),
            const SizedBox(width: 4),
            IconButton(
              onPressed: () => store.removeTrustedServer(_id),
              icon: const Icon(Icons.close, size: 14),
              color: ZColors.mutedForeground,
              padding: const EdgeInsets.all(4),
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: 4),
          ],
          ElevatedButton(
            onPressed: isConnected ? null : _connect,
            style: ElevatedButton.styleFrom(
              backgroundColor: isConnected ? ZColors.muted : null,
              foregroundColor: isConnected ? ZColors.mutedForeground : null,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(isConnected ? 'Connected' : 'Connect',
                style: ZText.body(12, weight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

class _ManualConnectCard extends StatelessWidget {
  final TextEditingController controller;
  final bool expanded;
  final bool disabled;
  final VoidCallback onToggle;
  final VoidCallback onConnect;

  const _ManualConnectCard({
    required this.controller,
    required this.expanded,
    required this.disabled,
    required this.onToggle,
    required this.onConnect,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          GestureDetector(
            onTap: disabled ? null : onToggle,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Expanded(
                    child: Text('Manual Connection',
                        style: ZText.body(14, weight: FontWeight.w600,
                            color: disabled ? ZColors.mutedForeground : ZColors.foreground)),
                  ),
                  Icon(
                    expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    size: 18,
                    color: ZColors.mutedForeground,
                  ),
                ],
              ),
            ),
          ),
          if (expanded) ...[
            Divider(height: 1, color: ZColors.border.withValues(alpha: 0.15)),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  TextField(
                    controller: controller,
                    enabled: !disabled,
                    style: ZText.body(14),
                    decoration: const InputDecoration(
                      hintText: '192.168.1.x',
                      labelText: 'IP Address',
                    ),
                    keyboardType: TextInputType.number,
                    onSubmitted: (_) => onConnect(),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: disabled ? null : onConnect,
                      child: const Text('Connect'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
