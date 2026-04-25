import 'dart:async';
import 'package:flutter/material.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/universal_player_store.dart';
import '../../../stores/media_player_store.dart';

/// Single video controls overlay — used in both inline and fullscreen modes.
/// Wires store commands to playback, tracks, and volume.
/// Fullscreen is delegated to media_kit via [VideoState.enterFullscreen] /
/// [VideoState.exitFullscreen] so the OS handles the actual window state.
/// Store's [isFullscreen] flag stays in sync via [_syncFullscreen].
class VideoControls extends StatefulWidget {
  final VideoState state;
  final VoidCallback onClose;

  const VideoControls({
    super.key,
    required this.state,
    required this.onClose,
  });

  @override
  State<VideoControls> createState() => _VideoControlsState();
}

class _VideoControlsState extends State<VideoControls> {
  static const _hideDelay = Duration(seconds: 4);

  bool _visible = true;
  Timer? _hideTimer;
  bool _kitFullscreen = false; // tracks media_kit fs state

  @override
  void initState() {
    super.initState();
    _resetTimer();
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    super.dispose();
  }

  void _resetTimer() {
    _hideTimer?.cancel();
    _hideTimer = Timer(_hideDelay, () {
      if (mounted) setState(() => _visible = false);
    });
  }

  void _show() {
    setState(() => _visible = true);
    _resetTimer();
  }

  /// Called when store's isFullscreen changes (e.g. via P2P command).
  void _syncFullscreen(bool storeFs) {
    if (storeFs == _kitFullscreen) return;
    if (storeFs) {
      widget.state.enterFullscreen();
    } else {
      widget.state.exitFullscreen();
    }
    _kitFullscreen = storeFs;
  }

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

    // Sync P2P-driven fullscreen changes into media_kit
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _syncFullscreen(player.isFullscreen);
    });

    final paused = player.playerState == PlayerState.paused ||
        player.playerState == PlayerState.idle ||
        player.playerState == PlayerState.stopped;
    final progress = player.duration > 0
        ? (player.time / player.duration).clamp(0.0, 1.0)
        : 0.0;
    final isDisabled = player.playerState == PlayerState.idle ||
        player.playerState == PlayerState.stopped;

    return MouseRegion(
      onEnter: (_) => _show(),
      child: GestureDetector(
        onTap: _show,
        behavior: HitTestBehavior.translucent,
        child: AnimatedOpacity(
          opacity: _visible ? 1.0 : 0.0,
          duration: const Duration(milliseconds: 250),
          child: IgnorePointer(
            ignoring: !_visible,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Color(0xCC000000)],
                ),
              ),
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  // Title
                  if (player.currentItem != null)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          player.currentItem!.name,
                          style: ZText.body(13, weight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),

                  // Seek bar
                  Row(
                    children: [
                      Text(_fmt(player.time),
                          style: ZText.body(11, color: ZColors.mutedForeground)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: GestureDetector(
                          onTapDown: (d) {
                            if (isDisabled) return;
                            final box = context.findRenderObject() as RenderBox?;
                            if (box == null) return;
                            final frac =
                                (d.localPosition.dx / box.size.width).clamp(0.0, 1.0);
                            player.playback(time: frac * player.duration);
                          },
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(2),
                            child: LinearProgressIndicator(
                              value: progress.toDouble(),
                              minHeight: 3,
                              backgroundColor: ZColors.border.withValues(alpha: 0.3),
                              valueColor:
                                  const AlwaysStoppedAnimation(ZColors.primary),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(_fmt(player.duration),
                          style: ZText.body(11, color: ZColors.mutedForeground)),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Controls row
                  Row(
                    children: [
                      // Play / Pause
                      _Btn(
                        icon: paused ? Icons.play_arrow : Icons.pause,
                        size: 22,
                        onTap: () => player.playback(
                            action: paused ? 'play' : 'pause'),
                      ),
                      const SizedBox(width: 4),

                      // Seek -10s
                      _Btn(
                        icon: Icons.replay_10,
                        onTap: () => player.playback(
                            time: (player.time - 10).clamp(0, player.duration)),
                      ),

                      // Seek +10s
                      _Btn(
                        icon: Icons.forward_10,
                        onTap: () => player.playback(
                            time: (player.time + 10).clamp(0, player.duration)),
                      ),
                      const SizedBox(width: 8),

                      // Volume
                      _Btn(
                        icon: player.isMuted
                            ? Icons.volume_off
                            : Icons.volume_up_outlined,
                        onTap: () => player.audio(mute: !player.isMuted),
                      ),

                      const Spacer(),

                      // Audio track dropdown
                      if (player.audioTracks.isNotEmpty)
                        _TrackDropdown(
                          icon: Icons.language_outlined,
                          tooltip: 'Audio',
                          tracks: player.audioTracks
                              .map((t) => _TrackItem(id: t.id, name: t.name))
                              .toList(),
                          currentId: player.currentAudioTrack,
                          onSelect: (id) => player.audio(track: id),
                        ),

                      const SizedBox(width: 4),

                      // Subtitle track dropdown
                      _TrackDropdown(
                        icon: Icons.subtitles_outlined,
                        tooltip: 'Subtitles',
                        tracks: [
                          const _TrackItem(id: -1, name: 'Off'),
                          ...player.subtitleTracks
                              .map((t) => _TrackItem(id: t.id, name: t.name)),
                        ],
                        currentId: player.currentSubtitleTrack,
                        onSelect: (id) => player.subtitle(track: id),
                      ),

                      const SizedBox(width: 8),

                      // Fullscreen toggle
                      _Btn(
                        icon: _kitFullscreen
                            ? Icons.fullscreen_exit
                            : Icons.fullscreen,
                        onTap: () {
                          if (_kitFullscreen) {
                            _kitFullscreen = false;
                            widget.state.exitFullscreen();
                            player.setFullscreen(false);
                          } else {
                            _kitFullscreen = true;
                            widget.state.enterFullscreen();
                            player.setFullscreen(true);
                          }
                        },
                      ),

                      // Close
                      _Btn(
                        icon: Icons.close,
                        onTap: widget.onClose,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Small icon button ─────────────────────────────────────────────────────────

class _Btn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final double size;

  const _Btn({required this.icon, required this.onTap, this.size = 18});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        child: Icon(icon, color: Colors.white, size: size),
      ),
    );
  }
}

// ── Track dropdown ────────────────────────────────────────────────────────────

class _TrackItem {
  final int id;
  final String name;
  const _TrackItem({required this.id, required this.name});
}

class _TrackDropdown extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final List<_TrackItem> tracks;
  final int currentId;
  final void Function(int) onSelect;

  const _TrackDropdown({
    required this.icon,
    required this.tooltip,
    required this.tracks,
    required this.currentId,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<int>(
      tooltip: tooltip,
      color: ZColors.secondary,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: ZColors.border.withValues(alpha: 0.2)),
      ),
      offset: const Offset(0, -8),
      onSelected: onSelect,
      itemBuilder: (_) => tracks
          .map(
            (t) => PopupMenuItem<int>(
              value: t.id,
              height: 36,
              child: Row(
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: t.id == currentId
                          ? ZColors.primary
                          : Colors.transparent,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    t.name,
                    style: ZText.body(13,
                        color: t.id == currentId
                            ? ZColors.primary
                            : ZColors.foreground),
                  ),
                ],
              ),
            ),
          )
          .toList(),
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        child: Icon(icon, color: Colors.white, size: 18),
      ),
    );
  }
}
