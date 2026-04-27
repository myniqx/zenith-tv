import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../core/tv_focus.dart';
import '../../../stores/profile_store.dart';
import '../../../stores/content_store.dart';
import '../shared/profile_helpers.dart';

class ProfileCardTv extends StatelessWidget {
  final Profile profile;
  final bool isActive;
  final VoidCallback onLoad;
  final VoidCallback onDelete;

  const ProfileCardTv({
    super.key,
    required this.profile,
    required this.isActive,
    required this.onLoad,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final contentStore = context.watch<ContentStore>();
    final profileStore = context.read<ProfileStore>();

    final activeUUID = profile.m3uRefs.isNotEmpty
        ? (isActive ? contentStore.currentUUID : null) ?? profile.m3uRefs.first
        : null;

    final channelCount = isActive ? contentStore.calculateStats().totalWatchables : null;
    final hasM3U = profile.m3uRefs.isNotEmpty;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(16),
        border: isActive
            ? Border.all(color: ZColors.primary.withValues(alpha: 0.4), width: 1.5)
            : Border.all(color: ZColors.border.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          // ── Header: avatar + isim + stats ──────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 12),
            child: Row(
              children: [
                ProfileAvatar(isActive: isActive, size: 52),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(profile.username, style: ZText.headline(20)),
                          if (isActive) ...[
                            const SizedBox(width: 12),
                            const ActiveBadge(),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${profile.m3uRefs.length} M3U kaynağı',
                        style: ZText.body(13, color: ZColors.mutedForeground),
                      ),
                    ],
                  ),
                ),

                // Sağ: kanal/kaynak istatistiği
                if (activeUUID != null)
                  _StatsChip(
                    label: channelCount != null ? '$channelCount kanal' : m3uDisplayName(profileStore, activeUUID),
                    isLoading: contentStore.isLoading && isActive,
                  ),
              ],
            ),
          ),

          // ── Aksiyon butonları ──────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
            child: TvHorizontalList(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (hasM3U)
                  TvButton(
                    label: 'Yükle',
                    icon: Icons.play_arrow_rounded,
                    onSelect: onLoad,
                    autofocus: true,
                  ),
                if (hasM3U) const SizedBox(width: 8),
                if (hasM3U)
                  TvButton(
                    label: 'Güncelle',
                    icon: Icons.refresh_rounded,
                    onSelect: () async {
                      final store = context.read<ContentStore>();
                      final uuid = profile.m3uRefs.first;
                      if (!isActive) {
                        await store.setContent(profile.username, uuid);
                      }
                      await store.update();
                    },
                  ),
                if (hasM3U) const SizedBox(width: 8),
                TvFocusable(
                  onSelect: onDelete,
                  builder: (context, focused) => Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      color: focused ? ZColors.destructive : Colors.transparent,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: focused
                            ? ZColors.destructiveFg.withValues(alpha: 0.4)
                            : ZColors.border.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Icon(
                      Icons.delete_outline_rounded,
                      size: 18,
                      color: focused ? ZColors.destructiveFg : ZColors.mutedForeground,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsChip extends StatelessWidget {
  final String label;
  final bool isLoading;

  const _StatsChip({required this.label, this.isLoading = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: ZColors.muted,
        borderRadius: BorderRadius.circular(999),
      ),
      child: isLoading
          ? const SizedBox(
              width: 14, height: 14,
              child: CircularProgressIndicator(strokeWidth: 2, color: ZColors.primary),
            )
          : Text(label, style: ZText.body(13, color: ZColors.mutedForeground)),
    );
  }
}
