import 'package:flutter/material.dart';
import 'package:media_kit_video/media_kit_video.dart';
import '../shared/controls_overlay.dart';
import '../shared/multi_layer_player.dart';

/// Phone video player:
///   portrait  → compact video box (16:9) + content below
///   landscape → fullscreen MultiLayerPlayer
class VideoPlayerPhone extends StatefulWidget {
  final VideoController controller;
  final VoidCallback onClose;

  const VideoPlayerPhone({
    super.key,
    required this.controller,
    required this.onClose,
  });

  @override
  State<VideoPlayerPhone> createState() => _VideoPlayerPhoneState();
}

class _VideoPlayerPhoneState extends State<VideoPlayerPhone> {
  bool _showControls = false;

  @override
  Widget build(BuildContext context) {
    final orientation = MediaQuery.of(context).orientation;

    if (orientation == Orientation.landscape) {
      return MultiLayerPlayer(
        controller: widget.controller,
        onClose: widget.onClose,
      );
    }

    // Portrait — compact top video box
    return GestureDetector(
      onTap: () => setState(() => _showControls = !_showControls),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: Stack(
          children: [
            Video(controller: widget.controller, controls: NoVideoControls),
            if (_showControls)
              Positioned.fill(
                child: ControlsOverlay(onClose: widget.onClose),
              ),
          ],
        ),
      ),
    );
  }
}
