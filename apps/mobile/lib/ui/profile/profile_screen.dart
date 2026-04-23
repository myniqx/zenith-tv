import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/device_type.dart';
import '../../stores/profile_store.dart';
import '../../stores/content_store.dart';
import 'phone/profile_screen_phone.dart';
import 'tv/profile_screen_tv.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer2<ProfileStore, ContentStore>(
      builder: (context, profileStore, contentStore, _) {
        if (DeviceTypeDetector.isTV) {
          return const ProfileScreenTv();
        }
        return ProfileScreenPhone(
          profileStore: profileStore,
          contentStore: contentStore,
        );
      },
    );
  }
}
