import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/device_type.dart';
import '../../p2p/client/p2p_client_store.dart';
import '../../p2p/models/discovered_controller.dart';
import '../../p2p/server/p2p_server_store.dart';
import 'phone/p2p_screen_phone.dart';
import 'tablet/p2p_screen_tablet.dart';
import 'tv/p2p_screen_tv.dart';

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
      deviceId: 'manual-$ip', deviceName: 'Manuel ($ip)',
      ip: ip, port: 8080, version: '1.0.0',
    ));
  }

  @override
  Widget build(BuildContext context) {
    if (DeviceTypeDetector.isPhone) {
      return Consumer<P2PServerStore>(
        builder: (context, serverStore, child) => P2PScreenPhone(serverStore: serverStore),
      );
    }

    if (DeviceTypeDetector.isTV) {
      return Consumer2<P2PClientStore, P2PServerStore>(
        builder: (context, clientStore, serverStore, child) => P2PScreenTv(
          clientStore: clientStore,
          serverStore: serverStore,
        ),
      );
    }

    return Consumer2<P2PClientStore, P2PServerStore>(
      builder: (context, clientStore, serverStore, child) => P2PScreenTablet(
        clientStore: clientStore,
        serverStore: serverStore,
        manualIpController: _manualIpController,
        onConnectManual: () => _connectManual(clientStore),
      ),
    );
  }
}
