import 'dart:async';
import 'package:flutter/material.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:provider/provider.dart';
import '../../../stores/universal_player_store.dart';
import 'controls_overlay.dart';
import 'track_panel.dart';

enum _Panel { none, tracks }

/// Fullscreen video player shell with directional overlay panels.
/// Mirrors: apps/tizen/src/components/MediaPlayer/MediaPlayer.tsx + MultiLayer
///
/// Controls auto-hide after [_hideDelay]. Tap anywhere to show again.
/// Track panel slides in from the left.
///
/// Exit fullscreen  → calls setFullscreen(false) on store
/// Close player     → calls close() on store
class MultiLayerPlayer extends StatefulWidget {
  final VideoController controller;

  /// Called when user wants to fully stop & close the player (X button).
  final VoidCallback onClose;

  const MultiLayerPlayer({
    super.key,
    required this.controller,
    required this.onClose,
  });

  @override
  State<MultiLayerPlayer> createState() => _MultiLayerPlayerState();
}

class _MultiLayerPlayerState extends State<MultiLayerPlayer>
    with SingleTickerProviderStateMixin {
  static const _hideDelay = Duration(seconds: 4);
  static const _animDuration = Duration(milliseconds: 250);

  _Panel _panel = _Panel.none;
  bool _controlsVisible = true;
  Timer? _hideTimer;

  late final AnimationController _slideCtrl;
  late final Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _slideCtrl = AnimationController(vsync: this, duration: _animDuration);
    _slideAnim = Tween<Offset>(begin: const Offset(-1, 0), end: Offset.zero)
        .animate(CurvedAnimation(parent: _slideCtrl, curve: Curves.easeOutCubic));
    _resetTimer();
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    _slideCtrl.dispose();
    super.dispose();
  }

  void _resetTimer() {
    _hideTimer?.cancel();
    _hideTimer = Timer(_hideDelay, () {
      if (mounted && _panel == _Panel.none) {
        setState(() => _controlsVisible = false);
      }
    });
  }

  void _showControls() {
    setState(() => _controlsVisible = true);
    _resetTimer();
  }

  void _openPanel(_Panel panel) {
    setState(() {
      _panel = panel;
      _controlsVisible = true;
    });
    _hideTimer?.cancel();
    _slideCtrl.forward();
  }

  void _closePanel() {
    _slideCtrl.reverse().then((_) {
      if (mounted) setState(() => _panel = _Panel.none);
    });
    _resetTimer();
  }

  @override
  Widget build(BuildContext context) {
    final player = context.watch<UniversalPlayerStore>();

    return GestureDetector(
      onTap: _panel == _Panel.none ? _showControls : _closePanel,
      child: Stack(
        children: [
          // Base video layer
          Video(controller: widget.controller, controls: NoVideoControls),

          // Controls overlay (bottom)
          AnimatedOpacity(
            opacity: _controlsVisible ? 1.0 : 0.0,
            duration: _animDuration,
            child: IgnorePointer(
              ignoring: !_controlsVisible,
              child: Align(
                alignment: Alignment.bottomCenter,
                child: _ControlsBar(
                  onClose: widget.onClose,
                  onOpenTracks: () => _openPanel(_Panel.tracks),
                  panel: _panel,
                ),
              ),
            ),
          ),

          // Track panel (left slide-in)
          if (_panel == _Panel.tracks)
            SlideTransition(
              position: _slideAnim,
              child: Align(
                alignment: Alignment.centerLeft,
                child: GestureDetector(
                  onTap: () {}, // absorb taps inside panel
                  child: TrackPanel(onClose: _closePanel),
                ),
              ),
            ),

          // Error banner
          if (player.error != null)
            Positioned(
              top: 20, left: 0, right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4D1F1F),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(player.error!,
                      style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 13)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ControlsBar extends StatelessWidget {
  final VoidCallback onClose;
  final VoidCallback onOpenTracks;
  final _Panel panel;

  const _ControlsBar({
    required this.onClose,
    required this.onOpenTracks,
    required this.panel,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ControlsOverlay(onClose: onClose),
        // Track panel toggle (bottom-left)
        Positioned(
          left: 20,
          bottom: 80,
          child: GestureDetector(
            onTap: onOpenTracks,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: panel == _Panel.tracks
                    ? const Color(0xFF2E2650)
                    : Colors.black.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: panel == _Panel.tracks
                      ? const Color(0xFFB6A0FF)
                      : Colors.white.withValues(alpha: 0.15),
                ),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.tune, size: 14, color: Color(0xFFB6A0FF)),
                  SizedBox(width: 6),
                  Text('Tracks',
                      style: TextStyle(
                          color: Color(0xFFB6A0FF),
                          fontSize: 12,
                          fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
