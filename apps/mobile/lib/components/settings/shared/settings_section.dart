import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';

class SettingsSection extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;

  const SettingsSection({
    super.key,
    required this.title,
    required this.icon,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            children: [
              Icon(icon, size: 16, color: ZColors.mutedForeground),
              const SizedBox(width: 8),
              Text(title.toUpperCase(), style: ZText.labelUpper),
            ],
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: ZColors.secondary,
            borderRadius: BorderRadius.circular(10),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            children: [
              for (int i = 0; i < children.length; i++) ...[
                children[i],
                if (i < children.length - 1)
                  Divider(height: 1, color: ZColors.border.withValues(alpha: 0.15)),
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),
      ],
    );
  }
}
