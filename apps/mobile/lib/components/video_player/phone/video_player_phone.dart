import 'package:flutter/material.dart';
import 'package:media_kit_video/media_kit_video.dart';
import '../shared/video_controls.dart';

/// Phone video player — same architecture as tablet.
/// Portrait: 16:9 box above content. Landscape: media_kit native fullscreen.
class VideoPlayerPhone extends StatelessWidget {
  final VideoController controller;
  final VoidCallback onClose;

  const VideoPlayerPhone({
    super.key,
    required this.controller,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: Video(
        controller: controller,
        controls: (state) => VideoControls(state: state, onClose: onClose),
      ),
    );
  }
}
