import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';
import '../../../p2p/client/p2p_client_store.dart';
import '../../../p2p/client/p2p_client.dart';
import 'server_tile.dart';

// Tablet ve TV'nin ortak kullandığı client-side card'lar.

class ClientStatusCard extends StatelessWidget {
  final P2PClientStore store;
  final bool isTV;

  const ClientStatusCard({super.key, required this.store, this.isTV = false});

  @override
  Widget build(BuildContext context) {
    final status  = store.connectionStatus;
    final current = store.currentServer;

    final (dotColor, label) = switch (status) {
      P2PConnectionStatus.connected  => (ZColors.successFg, current != null ? '${current.deviceName} (${current.ip})' : 'Bağlı'),
      P2PConnectionStatus.connecting => (ZColors.warningFg, 'Bağlanıyor...'),
      P2PConnectionStatus.error      => (ZColors.warningFg, store.error ?? 'Bağlantı hatası'),
      _                              => (ZColors.mutedForeground, 'Bağlı değil'),
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
            width: 10, height: 10,
            decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(label, style: ZText.body(isTV ? 16 : 14))),
          if (status == P2PConnectionStatus.connected)
            TextButton(
              onPressed: store.disconnect,
              style: TextButton.styleFrom(foregroundColor: ZColors.destructiveFg),
              child: const Text('Bağlantıyı Kes'),
            ),
        ],
      ),
    );
  }
}

class ManualConnectCard extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onConnect;

  const ManualConnectCard({
    super.key,
    required this.controller,
    required this.onConnect,
  });

  @override
  Widget build(BuildContext context) {
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
          Text('Manuel Bağlan', style: ZText.body(15, weight: FontWeight.w600)),
          const SizedBox(height: 12),
          TextField(
            controller: controller,
            style: ZText.body(14),
            decoration: const InputDecoration(hintText: '192.168.1.X'),
            keyboardType: TextInputType.number,
            onSubmitted: (_) => onConnect(),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(onPressed: onConnect, child: const Text('Bağlan')),
          ),
        ],
      ),
    );
  }
}

class DiscoveredServersCard extends StatelessWidget {
  final P2PClientStore store;
  final bool isTV;

  const DiscoveredServersCard({super.key, required this.store, this.isTV = false});

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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Cihazlar', style: ZText.body(isTV ? 18 : 15, weight: FontWeight.w600)),
              ElevatedButton.icon(
                onPressed: store.isScanning ? null : store.scan,
                icon: store.isScanning
                    ? const SizedBox(width: 13, height: 13,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.refresh, size: 15),
                label: Text(store.isScanning ? 'Taranıyor...' : 'Tara'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: ZColors.muted,
                  foregroundColor: ZColors.foreground,
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
                  'Cihaz bulunamadı.\nDiğer cihazda uygulamanın açık olduğundan emin olun.',
                  textAlign: TextAlign.center,
                  style: ZText.body(13, color: ZColors.mutedForeground),
                ),
              ),
            )
          else
            ...allServers.map((s) => ServerTile(server: s, store: store, isTV: isTV)),
        ],
      ),
    );
  }
}
