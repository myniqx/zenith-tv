import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../core/device_type.dart';

class SettingRow extends StatelessWidget {
  final String label;
  final String? description;
  final Widget control;
  /// Hide this row on the given device types. e.g. [DeviceType.phone]
  final List<DeviceType> hidePlatforms;

  const SettingRow({
    super.key,
    required this.label,
    required this.control,
    this.description,
    this.hidePlatforms = const [],
  });

  @override
  Widget build(BuildContext context) {
    if (hidePlatforms.isNotEmpty) {
      final current = context.read<DeviceTypeDetector>().current;
      if (hidePlatforms.contains(current)) return const SizedBox.shrink();
    }

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
