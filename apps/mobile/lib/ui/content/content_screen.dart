import 'package:flutter/material.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:provider/provider.dart';
import '../../core/app_theme.dart';
import '../../core/device_type.dart';
import '../../stores/content_store.dart';
import '../../stores/universal_player_store.dart';
import '../../components/toolbar/toolbar.dart';
import '../../components/toolbar/phone/toolbar_phone.dart';
import '../../components/content_grid/content_grid.dart';
import '../../components/video_player/phone/video_player_phone.dart';

class ContentScreen extends StatelessWidget {
  final VideoController? controller;

  const ContentScreen({super.key, this.controller});

  @override
  Widget build(BuildContext context) {
    final detector   = context.watch<DeviceTypeDetector>();
    final store      = context.watch<ContentStore>();
    final player     = context.watch<UniversalPlayerStore>();

    if (store.isLoading) {
      return Scaffold(
        backgroundColor: ZColors.background,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 48),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Loading...', style: ZText.body(14, color: ZColors.mutedForeground)),
                const SizedBox(height: 16),
                LinearProgressIndicator(
                  value: store.loadProgress > 0 ? store.loadProgress : null,
                  backgroundColor: ZColors.secondary,
                  valueColor: const AlwaysStoppedAnimation(ZColors.primary),
                  minHeight: 3,
                  borderRadius: BorderRadius.circular(2),
                ),
                const SizedBox(height: 8),
                Text(
                  '${(store.loadProgress * 100).toStringAsFixed(0)}%',
                  style: ZText.body(12, color: ZColors.mutedForeground),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (detector.isPhone) {
      final hasPlayer = player.currentItem != null && controller != null;

      return Scaffold(
        backgroundColor: ZColors.background,
        drawer: const CategoryDrawer(),
        body: Column(
          children: [
            // Video player — visible only when something is playing
            if (hasPlayer)
              VideoPlayerPhone(
                controller: controller!,
                onClose: () => player.close(),
              ),
            const Toolbar(),
            const Expanded(child: ContentGrid()),
          ],
        ),
      );
    }

    // Tablet / TV — toolbar + layout in AppShellTablet, just return grid
    return const ContentGrid();
  }
}
