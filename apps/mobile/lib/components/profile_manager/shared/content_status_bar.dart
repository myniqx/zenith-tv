import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/content_store.dart';

/// Mirrors apps/desktop/src/components/ProfileManager/StatusBar.tsx
/// No props — reads ContentStore directly.
class ContentStatusBar extends StatelessWidget {
  const ContentStatusBar({super.key});

  @override
  Widget build(BuildContext context) {
    final status = context.select<ContentStore, StatusMessage>(
      (s) => s.statusMessage,
    );

    if (status.isIdle) return const SizedBox.shrink();

    final color = switch (status.status) {
      StatusKind.error   => ZColors.destructiveFg,
      StatusKind.ready   => ZColors.successFg,
      StatusKind.loading => ZColors.mutedForeground,
      StatusKind.idle    => ZColors.mutedForeground,
    };

    final barColor = switch (status.status) {
      StatusKind.loading => ZColors.primary,
      StatusKind.ready   => ZColors.successFg,
      _                  => Colors.transparent,
    };

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (status.message != null)
            Text(
              status.message!,
              style: ZText.body(12, color: color),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: LinearProgressIndicator(
              value: status.percent,
              minHeight: 2,
              backgroundColor: ZColors.border.withValues(alpha: 0.2),
              valueColor: AlwaysStoppedAnimation(barColor),
            ),
          ),
        ],
      ),
    );
  }
}
