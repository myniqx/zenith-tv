import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/device_type.dart';
import '../../core/debug_panel.dart';
import 'phone/app_shell_phone.dart';
import 'tablet/app_shell_tablet.dart';
import 'tv/app_shell_tv.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key});

  @override
  Widget build(BuildContext context) {
    final detector = context.watch<DeviceTypeDetector>();
    final shell = switch (detector.current) {
      DeviceType.phone  => const AppShellPhone(),
      DeviceType.tablet => const AppShellTablet(),
      DeviceType.tv     => const AppShellTv(),
    };
    return DebugPanel(child: shell);
  }
}
