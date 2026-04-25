import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import '../shared/video_controls.dart';

/// Inline video player panel — sits to the right of content_grid in tablet shell.
/// Controls and fullscreen are fully handled by [VideoControls] via media_kit.
class VideoPlayerTablet extends StatelessWidget {
  final Player player;
  final VideoController controller;
  final VoidCallback onClose;

  const VideoPlayerTablet({
    super.key,
    required this.player,
    required this.controller,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return Video(
      controller: controller,
      controls: (state) => VideoControls(state: state, onClose: onClose),
    );
  }
}
