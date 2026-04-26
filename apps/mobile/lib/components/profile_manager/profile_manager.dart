import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/device_type.dart';
import 'phone/profile_manager_phone.dart';
import 'tablet/profile_manager_tablet.dart';
import 'tv/profile_manager_tv.dart';

class ProfileManager extends StatelessWidget {
  final VoidCallback? onLoaded;

  const ProfileManager({super.key, this.onLoaded});

  @override
  Widget build(BuildContext context) {
    final detector = context.watch<DeviceTypeDetector>();

    return switch (detector.current) {
      DeviceType.phone  => ProfileManagerPhone(onLoaded: onLoaded),
      DeviceType.tablet => ProfileManagerTablet(onLoaded: onLoaded),
      DeviceType.tv     => const ProfileManagerTv(),
    };
  }
}
