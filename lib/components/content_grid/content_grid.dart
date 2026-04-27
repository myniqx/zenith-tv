import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/app_theme.dart';
import '../../core/device_type.dart';
import '../../stores/content_store.dart';
import 'shared/content_group.dart';

class ContentGrid extends StatelessWidget {
  const ContentGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final detector = context.watch<DeviceTypeDetector>();

    if (detector.isTV) {
      return Center(
        child: Text('TV content grid — coming soon',
            style: ZText.body(18, color: ZColors.mutedForeground)),
      );
    }

    return Consumer<ContentStore>(
      builder: (context, store, _) {
        if (!store.isReady) {
          return Center(
            child: Text('Select a profile to browse content',
                style: ZText.body(14, color: ZColors.mutedForeground)),
          );
        }

        if (store.groupedContent.isEmpty ||
            store.groupedContent.every((g) => g.items.isEmpty)) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.inbox_outlined,
                    size: 64, color: ZColors.mutedForeground),
                const SizedBox(height: 16),
                Text('No content found', style: ZText.headline(22)),
                const SizedBox(height: 8),
                Text('Try selecting a different category or adjusting filters',
                    style: ZText.body(14, color: ZColors.mutedForeground)),
              ],
            ),
          );
        }

        return LayoutBuilder(
          builder: (context, constraints) {
            final crossAxisCount = _autoColumns(constraints.maxWidth);

            return ListView.builder(
              key: ValueKey(store.currentGroup?.name),
              itemCount: store.groupedContent.length,
              itemBuilder: (context, i) => ContentGroup(
                data: store.groupedContent[i],
                crossAxisCount: crossAxisCount,
              ),
            );
          },
        );
      },
    );
  }

  /// Mirrors desktop ResizeObserver logic: min card width 160px + 16px gap.
  int _autoColumns(double width) {
    const minCardWidth = 180.0;
    const gap = 12.0;
    return ((width + gap) / (minCardWidth + gap)).floor().clamp(2, 12);
  }
}
