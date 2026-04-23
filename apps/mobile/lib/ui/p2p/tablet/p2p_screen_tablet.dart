import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';
import '../../../p2p/client/p2p_client_store.dart';
import '../../../p2p/server/p2p_server_store.dart';
import '../shared/client_cards.dart';

class P2PScreenTablet extends StatelessWidget {
  final P2PClientStore clientStore;
  final P2PServerStore serverStore;
  final TextEditingController manualIpController;
  final VoidCallback onConnectManual;

  const P2PScreenTablet({
    super.key,
    required this.clientStore,
    required this.serverStore,
    required this.manualIpController,
    required this.onConnectManual,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ZColors.background,
      appBar: AppBar(title: const Text('P2P')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            ClientStatusCard(store: clientStore),
            const SizedBox(height: 16),
            ManualConnectCard(controller: manualIpController, onConnect: onConnectManual),
            const SizedBox(height: 16),
            DiscoveredServersCard(store: clientStore),
          ],
        ),
      ),
    );
  }
}
