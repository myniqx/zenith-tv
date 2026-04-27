import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/universal_player_store.dart';
import '../../../p2p/models/client_event.dart';

class TrackPanel extends StatelessWidget {
  final VoidCallback? onClose;

  const TrackPanel({super.key, this.onClose});

  @override
  Widget build(BuildContext context) {
    final player = context.watch<UniversalPlayerStore>();

    return Container(
      width: 280,
      decoration: BoxDecoration(
        color: ZColors.secondary.withValues(alpha: 0.95),
        border: Border(right: BorderSide(color: ZColors.border.withValues(alpha: 0.1))),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 12, 16),
            child: Row(
              children: [
                Text('Audio & Subtitles', style: ZText.headline(16)),
                const Spacer(),
                if (onClose != null)
                  GestureDetector(
                    onTap: onClose,
                    child: const Icon(Icons.close, size: 18, color: ZColors.mutedForeground),
                  ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
              children: [
                _TrackSection(
                  icon: Icons.volume_up_outlined,
                  label: 'Audio',
                  tracks: player.audioTracks,
                  currentId: player.currentAudioTrack,
                  onSelect: (id) => player.audio(track: id),
                ),
                const SizedBox(height: 20),
                _TrackSection(
                  icon: Icons.subtitles_outlined,
                  label: 'Subtitles',
                  tracks: player.subtitleTracks,
                  currentId: player.currentSubtitleTrack,
                  onSelect: (id) => player.subtitle(track: id),
                  showDisable: true,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TrackSection extends StatelessWidget {
  final IconData icon;
  final String label;
  final List<VlcTrack> tracks;
  final int currentId;
  final void Function(int) onSelect;
  final bool showDisable;

  const _TrackSection({
    required this.icon,
    required this.label,
    required this.tracks,
    required this.currentId,
    required this.onSelect,
    this.showDisable = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 13, color: ZColors.primary),
            const SizedBox(width: 6),
            Text(label.toUpperCase(), style: ZText.labelUpper),
          ],
        ),
        const SizedBox(height: 8),
        if (tracks.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            child: Text('No tracks', style: ZText.body(12, color: ZColors.mutedForeground)),
          ),
        if (showDisable)
          _TrackItem(
            label: 'Disabled',
            isActive: currentId < 0,
            onTap: () => onSelect(-1),
          ),
        for (final t in tracks)
          _TrackItem(
            label: t.name,
            isActive: t.id == currentId,
            onTap: () => onSelect(t.id),
          ),
      ],
    );
  }
}

class _TrackItem extends StatelessWidget {
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _TrackItem({required this.label, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 2),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: isActive ? ZColors.accent : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Container(
              width: 6, height: 6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isActive ? ZColors.primary : Colors.transparent,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: ZText.body(13,
                    color: isActive ? ZColors.primary : ZColors.foreground),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
