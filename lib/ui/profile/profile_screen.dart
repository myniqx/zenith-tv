import 'package:flutter/material.dart';
import '../../core/app_theme.dart';
import '../../components/profile_manager/profile_manager.dart';
import '../../core/device_type.dart';
import 'package:provider/provider.dart';
import 'tv/profile_screen_tv.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final detector = context.watch<DeviceTypeDetector>();

    if (detector.isTV) {
      return const ProfileScreenTv();
    }

    return Scaffold(
      backgroundColor: ZColors.background,
      appBar: AppBar(title: const Text('Profiles')),
      body: const ProfileManager(),
    );
  }
}
