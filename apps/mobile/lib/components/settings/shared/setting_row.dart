import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';

class SettingRow extends StatelessWidget {
  final String label;
  final String? description;
  final Widget control;

  const SettingRow({
    super.key,
    required this.label,
    required this.control,
    this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: ZText.body(14, weight: FontWeight.w500)),
                if (description != null) ...[
                  const SizedBox(height: 2),
                  Text(description!,
                      style: ZText.body(12, color: ZColors.mutedForeground)),
                ],
              ],
            ),
          ),
          const SizedBox(width: 16),
          control,
        ],
      ),
    );
  }
}
