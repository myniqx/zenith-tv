import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';
import '../../../p2p/server/p2p_server_store.dart';

class P2PScreenPhone extends StatelessWidget {
  final P2PServerStore serverStore;

  const P2PScreenPhone({super.key, required this.serverStore});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ZColors.background,
      appBar: AppBar(title: const Text('P2P')),
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
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 10, height: 10,
                decoration: BoxDecoration(
                  color: running ? ZColors.successFg : ZColors.mutedForeground,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 10),
              Text(
                running ? 'Sunucu çalışıyor (port ${serverStore.port})' : 'Sunucu durduruldu',
                style: ZText.body(16, weight: FontWeight.w600),
              ),
            ],
          ),
          if (serverStore.error != null) ...[
            const SizedBox(height: 8),
            Text(serverStore.error!, style: ZText.body(13, color: ZColors.destructiveFg)),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: running
                  ? serverStore.stopServer
                  : () => serverStore.startServer(deviceName: 'Zenith Phone'),
              style: ElevatedButton.styleFrom(
                backgroundColor: running ? ZColors.destructive : ZColors.success,
                foregroundColor: running ? ZColors.destructiveFg : ZColors.successFg,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: Text(running ? 'Sunucuyu Durdur' : 'Sunucuyu Başlat'),
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
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Bağlı Cihazlar (${connections.length})',
              style: ZText.body(16, weight: FontWeight.w600)),
          const SizedBox(height: 12),
          if (connections.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  'Bağlı cihaz yok.\nTV veya tablet bağlandığında burada görünür.',
                  textAlign: TextAlign.center,
                  style: ZText.body(14, color: ZColors.mutedForeground),
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
                  color: isSelected ? ZColors.accent : ZColors.muted,
                  borderRadius: BorderRadius.circular(10),
                  border: isSelected
                      ? Border.all(color: ZColors.primary.withValues(alpha: 0.4))
                      : null,
                ),
                child: Row(
                  children: [
                    const Icon(Icons.tv, color: ZColors.mutedForeground, size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(c.deviceName ?? c.ip,
                              style: ZText.body(14, weight: FontWeight.w600)),
                          Text(c.ip, style: ZText.bodySm),
                        ],
                      ),
                    ),
                    if (isSelected)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: ZColors.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text('Aktif',
                            style: ZText.body(11, weight: FontWeight.w700, color: ZColors.primary)),
                      )
                    else
                      TextButton(
                        onPressed: () => serverStore.selectDevice(c.id),
                        child: const Text('Aktif Yap'),
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
