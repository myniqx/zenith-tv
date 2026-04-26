import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/device_type.dart';
import 'tablet/toolbar_tablet.dart';
import 'phone/toolbar_phone.dart';

class Toolbar extends StatelessWidget {
  const Toolbar({super.key});

  @override
  Widget build(BuildContext context) {
    final detector = context.watch<DeviceTypeDetector>();
    return switch (detector.current) {
      DeviceType.tablet => const ToolbarTablet(),
      DeviceType.tv     => const ToolbarTablet(),
      DeviceType.phone  => const ToolbarPhone(),
    };
  }
}
