import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';
import '../../../p2p/client/p2p_client_store.dart';
import '../../../p2p/client/trusted_server.dart';
import '../../../p2p/models/discovered_controller.dart';

class ServerTile extends StatelessWidget {
  final dynamic server;
  final P2PClientStore store;
  final bool isTV;

  const ServerTile({
    super.key,
    required this.server,
    required this.store,
    this.isTV = false,
  });

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
                Text(_name, style: ZText.body(isTV ? 18 : 14, weight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text('$_ip:$_port', style: ZText.bodySm),
                if (isTrusted)
                  Container(
                    margin: const EdgeInsets.only(top: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: ZColors.success,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text('Kayıtlı',
                        style: ZText.body(10, weight: FontWeight.w700, color: ZColors.successFg)),
                  ),
              ],
            ),
          ),
          if (isTrusted && trusted != null)
            GestureDetector(
              onTap: () => store.updateTrustedServer(_id, autoConnect: !trusted.autoConnect),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: trusted.autoConnect ? ZColors.accent : ZColors.secondary,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text('Oto',
                    style: ZText.body(11, weight: FontWeight.w600,
                        color: trusted.autoConnect ? ZColors.primary : ZColors.mutedForeground)),
              ),
            ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: isConnected ? null : _connect,
            style: ElevatedButton.styleFrom(
              backgroundColor: isConnected ? ZColors.muted : ZColors.primary,
              foregroundColor: isConnected ? ZColors.mutedForeground : ZColors.primaryForeground,
              padding: EdgeInsets.symmetric(
                  horizontal: isTV ? 20 : 12, vertical: isTV ? 12 : 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(isConnected ? 'Bağlı' : 'Bağlan',
                style: ZText.body(isTV ? 14 : 12, weight: FontWeight.w600)),
          ),
          if (isTrusted)
            IconButton(
              onPressed: () => store.removeTrustedServer(_id),
              icon: const Icon(Icons.close, size: 16),
              color: ZColors.mutedForeground,
              padding: const EdgeInsets.all(4),
              constraints: const BoxConstraints(),
            ),
        ],
      ),
    );
  }
}
