import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/device_type.dart';
import 'phone/profile_manager_phone.dart';
import 'tablet/profile_manager_tablet.dart';
import 'tv/profile_manager_tv.dart';

class ProfileManager extends StatelessWidget {
  const ProfileManager({super.key});

  @override
  Widget build(BuildContext context) {
    final detector = context.watch<DeviceTypeDetector>();

    return switch (detector.current) {
      DeviceType.phone  => const ProfileManagerPhone(),
      DeviceType.tablet => const ProfileManagerTablet(),
      DeviceType.tv     => const ProfileManagerTv(),
    };
  }
}
