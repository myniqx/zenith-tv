import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';

class SettingsTv extends StatelessWidget {
  const SettingsTv({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text('Settings — coming soon',
          style: ZText.body(18, color: ZColors.mutedForeground)),
    );
  }
}
