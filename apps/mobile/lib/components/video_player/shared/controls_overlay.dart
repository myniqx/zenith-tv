import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/universal_player_store.dart';
import '../../../stores/media_player_store.dart';

class ControlsOverlay extends StatelessWidget {
  final VoidCallback onClose;

  const ControlsOverlay({super.key, required this.onClose});

  String _fmt(double seconds) {
    if (!seconds.isFinite || seconds < 0) return '0:00';
    final h = (seconds / 3600).floor();
    final m = ((seconds % 3600) / 60).floor();
    final s = (seconds % 60).floor();
    if (h > 0) {
      return '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    }
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final player = context.watch<UniversalPlayerStore>();
    final paused = player.playerState == PlayerState.paused ||
        player.playerState == PlayerState.idle ||
        player.playerState == PlayerState.stopped;
    final progress =
        player.duration > 0 ? (player.time / player.duration).clamp(0.0, 1.0) : 0.0;

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.transparent, Color(0xCC000000)],
        ),
      ),
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          // Seek bar
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(_fmt(player.time), style: ZText.body(12, weight: FontWeight.w700)),
                  Text(_fmt(player.duration), style: ZText.body(12, color: ZColors.mutedForeground)),
                ],
              ),
              const SizedBox(height: 6),
              GestureDetector(
                onTapDown: (d) {
                  final box = context.findRenderObject() as RenderBox?;
                  if (box == null) return;
                  final frac = (d.localPosition.dx / box.size.width).clamp(0.0, 1.0);
                  player.playback(time: frac * player.duration);
                },
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(
                    value: progress.toDouble(),
                    minHeight: 3,
                    backgroundColor: ZColors.border.withValues(alpha: 0.3),
                    valueColor: const AlwaysStoppedAnimation(ZColors.primary),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Buttons row
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Seek back 10s
              _IconBtn(
                icon: Icons.replay_10,
                onTap: () => player.playback(time: (player.time - 10).clamp(0, player.duration)),
              ),
              const SizedBox(width: 16),

              // Play / Pause
              GestureDetector(
                onTap: () => player.playback(action: paused ? 'play' : 'pause'),
                child: Container(
                  width: 52, height: 52,
                  decoration: const BoxDecoration(
                    color: ZColors.primary,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    paused ? Icons.play_arrow : Icons.pause,
                    color: ZColors.primaryForeground,
                    size: 28,
                  ),
                ),
              ),
              const SizedBox(width: 16),

              // Seek forward 10s
              _IconBtn(
                icon: Icons.forward_10,
                onTap: () => player.playback(time: (player.time + 10).clamp(0, player.duration)),
              ),
              const Spacer(),

              // Fullscreen toggle
              _IconBtn(
                icon: player.isFullscreen ? Icons.fullscreen_exit : Icons.fullscreen,
                onTap: () => player.setFullscreen(!player.isFullscreen),
              ),
              const SizedBox(width: 8),

              // Close
              _IconBtn(icon: Icons.close, onTap: onClose),
            ],
          ),
        ],
      ),
    );
  }
}

class _IconBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _IconBtn({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40, height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.4),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: ZColors.foreground, size: 20),
      ),
    );
  }
}
