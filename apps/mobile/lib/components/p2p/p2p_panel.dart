import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/device_type.dart';
import 'phone/p2p_panel_phone.dart';
import 'tablet/p2p_panel_tablet.dart';
import 'tv/p2p_panel_tv.dart';

class P2PPanel extends StatelessWidget {
  const P2PPanel({super.key});

  @override
  Widget build(BuildContext context) {
    final detector = context.watch<DeviceTypeDetector>();

    return switch (detector.current) {
      DeviceType.phone  => const P2PPanelPhone(),
      DeviceType.tablet => const P2PPanelTablet(),
      DeviceType.tv     => const P2PPanelTv(),
    };
  }
}
