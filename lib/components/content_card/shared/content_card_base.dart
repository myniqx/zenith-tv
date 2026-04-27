import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../models/watchable.dart';
import '../../../models/m3u_object.dart';
import '../../../stores/content_store.dart';
import '../../../stores/universal_player_store.dart';

class ContentCardBase extends StatelessWidget {
  final WatchableObject item;

  const ContentCardBase({super.key, required this.item});

  @override
  Widget build(BuildContext context) {
    final isFavorite = item.userData.favorite?.value ?? false;
    final progress = item.userData.watchProgress;
    final progressPercent = progress != null
        ? (progress.progress * 100).clamp(0.0, 100.0)
        : 0.0;
    final isWatched = progress?.watched != null;
    final durationMs = item.durationMs;
    final hasProgress = progressPercent > 0 && progressPercent < 95;

    return GestureDetector(
      onTap: () => context.read<UniversalPlayerStore>().play(item),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // Poster
                  item.logo.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: item.logo,
                          fit: BoxFit.cover,
                          errorWidget: (ctx, url, e) => _Fallback(category: item.category),
                          placeholder: (ctx, url) => _Fallback(category: item.category),
                        )
                      : _Fallback(category: item.category),

                  // Gradient overlay
                  Positioned.fill(
                    child: Container(
                          alignment: Alignment.center,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.4),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Category badge
                  Positioned(
                    top: 6, right: 6,
                    child: _CategoryBadge(category: item.category),
                  ),

                  // Favorite button
                  Positioned(
                    top: 2, left: 2,
                    child: GestureDetector(
                      onTap: () =>
                          context.read<ContentStore>().toggleFavorite(item),
                      behavior: HitTestBehavior.opaque,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.5),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isFavorite ? Icons.star : Icons.star_border,
                          color: isFavorite
                              ? ZColors.primary
                              : ZColors.mutedForeground,
                          size: 14,
                        ),
                      ),
                    ),
                  ),

                  // Year badge
                  if (item.year != null)
                    Positioned(
                      bottom: hasProgress ? 6 : 4, left: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 4, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.7),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: Text('${item.year}',
                            style: ZText.body(10)),
                      ),
                    ),

                  // Bottom-right: watched checkmark OR duration
                  if (isWatched)
                    Positioned(
                      bottom: hasProgress ? 6 : 4, right: 6,
                      child: Container(
                        width: 20, height: 20,
                        decoration: const BoxDecoration(
                            color: ZColors.successFg,
                            shape: BoxShape.circle),
                        child: const Icon(Icons.check,
                            color: ZColors.success, size: 12),
                      ),
                    )
                  else if (durationMs != null)
                    Positioned(
                      bottom: hasProgress ? 6 : 4, right: 6,
                      child: _DurationBadge(
                        durationMs: durationMs,
                        progressMs: hasProgress
                            ? (progress!.progress * durationMs).round()
                            : null,
                      ),
                    ),

                  // Progress bar
                  if (hasProgress)
                    Positioned(
                      bottom: 0, left: 0, right: 0,
                      child: Container(
                        height: 3,
                        color: Colors.black.withValues(alpha: 0.5),
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: progressPercent / 100,
                          child: Container(color: ZColors.primary),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(item.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: ZText.body(12, weight: FontWeight.w500)),
          if (item.group.isNotEmpty)
            Text(item.group,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: ZText.bodySm),
        ],
      ),
    );
  }
}

class _DurationBadge extends StatelessWidget {
  final int durationMs;
  final int? progressMs;

  const _DurationBadge({required this.durationMs, this.progressMs});

  String _fmt(int ms) {
    final total = ms ~/ 1000;
    final h = total ~/ 3600;
    final m = (total % 3600) ~/ 60;
    final s = total % 60;
    if (h > 0) {
      return '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    }
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final label = progressMs != null && progressMs! > 0
        ? '${_fmt(progressMs!)} / ${_fmt(durationMs)}'
        : _fmt(durationMs);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(3),
      ),
      child: Text(label, style: ZText.body(9)),
    );
  }
}

class _Fallback extends StatelessWidget {
  final M3UCategory category;
  const _Fallback({required this.category});

  @override
  Widget build(BuildContext context) {
    final icon = switch (category) {
      M3UCategory.liveStream => Icons.radio,
      M3UCategory.series     => Icons.tv,
      M3UCategory.movie      => Icons.movie_outlined,
    };
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [ZColors.secondary, ZColors.background],
        ),
      ),
      child: Icon(icon, color: ZColors.border, size: 48),
    );
  }
}

class _CategoryBadge extends StatelessWidget {
  final M3UCategory category;
  const _CategoryBadge({required this.category});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (category) {
      M3UCategory.liveStream => ('LIVE',   ZColors.destructiveFg),
      M3UCategory.series     => ('SERIES', ZColors.mutedForeground),
      M3UCategory.movie      => ('MOVIE',  ZColors.primary),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(label,
          style: ZText.body(9,
              weight: FontWeight.w800, color: ZColors.background)),
    );
  }
}
