import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import '../../core/device_type.dart';
import 'phone/video_player_phone.dart';
import 'tablet/video_player_tablet.dart';

export 'shared/multi_layer_player.dart';

/// Router — selects the correct video player layout for the current device type.
/// The [player] and [controller] are created and owned by the parent (app shell
/// or screen), so they survive navigation and layout switches.
class VideoPlayer extends StatelessWidget {
  final Player player;
  final VideoController controller;
  final VoidCallback onClose;

  const VideoPlayer({
    super.key,
    required this.player,
    required this.controller,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final deviceType = DeviceTypeDetector.instance.current;

    return switch (deviceType) {
      DeviceType.tablet => VideoPlayerTablet(
          player: player,
          controller: controller,
          onClose: onClose,
        ),
      DeviceType.tv => const SizedBox.shrink(), // TV handled by app_shell_tv
      _ => VideoPlayerPhone(
          controller: controller,
          onClose: onClose,
        ),
    };
  }
}
