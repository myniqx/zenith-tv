import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/app_theme.dart';
import '../../stores/content_store.dart';
import '../../models/group.dart';
import '../../models/watchable.dart';
import '../../models/m3u_object.dart';

class ContentScreen extends StatelessWidget {
  const ContentScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<ContentStore>(
      builder: (context, store, _) {
        if (store.isLoading) {
          return Scaffold(
            backgroundColor: ZColors.background,
            body: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 48),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Loading...', style: ZText.body(14, color: ZColors.mutedForeground)),
                    const SizedBox(height: 16),
                    LinearProgressIndicator(
                      value: store.loadProgress > 0 ? store.loadProgress : null,
                      backgroundColor: ZColors.secondary,
                      valueColor: const AlwaysStoppedAnimation(ZColors.primary),
                      minHeight: 3,
                      borderRadius: BorderRadius.circular(2),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${(store.loadProgress * 100).toStringAsFixed(0)}%',
                      style: ZText.body(12, color: ZColors.mutedForeground),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        if (store.error != null) {
          return Scaffold(
            backgroundColor: ZColors.background,
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline, color: ZColors.destructiveFg, size: 48),
                    const SizedBox(height: 16),
                    Text(store.error!, textAlign: TextAlign.center, style: ZText.body(14, color: ZColors.mutedForeground)),
                    const SizedBox(height: 24),
                    ElevatedButton(onPressed: store.load, child: const Text('Retry')),
                  ],
                ),
              ),
            ),
          );
        }

        final currentGroup = store.currentGroup;
        if (currentGroup == null) return _RootScreen(store: store);
        return _GroupScreen(store: store, group: currentGroup);
      },
    );
  }
}

// ── Root screen ───────────────────────────────────────────────────────────────

class _RootScreen extends StatelessWidget {
  final ContentStore store;
  const _RootScreen({required this.store});

  @override
  Widget build(BuildContext context) {
    final stats = store.calculateStats();
    final topGroups = [
      (store.movieGroup,    Icons.movie_outlined,       'Movies',    stats.movieCount),
      (store.tvShowGroup,   Icons.tv,                   'TV Shows',  stats.tvShowCount),
      (store.streamGroup,   Icons.radio,                'Live',      stats.liveStreamCount),
      (store.favoriteGroup, Icons.favorite_outline,     'Favorites', store.favoriteItems.length),
      (store.recentGroup,   Icons.history,              'Recent',    store.recentItems.length),
      (store.watchedGroup,  Icons.check_circle_outline, 'Watched',   store.watchedGroup.totalCount),
    ];

    return Scaffold(
      backgroundColor: ZColors.background,
      appBar: AppBar(
        title: Text('Content (${stats.totalWatchables})'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: store.update),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: topGroups
            .map((t) => _RootGroupTile(
                  group: t.$1, icon: t.$2, label: t.$3, count: t.$4,
                  onTap: () => store.setGroup(t.$1),
                ))
            .toList(),
      ),
    );
  }
}

class _RootGroupTile extends StatelessWidget {
  final GroupObject group;
  final IconData icon;
  final String label;
  final int count;
  final VoidCallback onTap;

  const _RootGroupTile({
    required this.group, required this.icon, required this.label,
    required this.count, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: ZColors.secondary,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, color: ZColors.mutedForeground, size: 20),
            const SizedBox(width: 12),
            Expanded(child: Text(label, style: ZText.titleLg)),
            Text('$count', style: ZText.bodySm),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right, color: ZColors.mutedForeground, size: 18),
          ],
        ),
      ),
    );
  }
}

// ── Group drill-down ──────────────────────────────────────────────────────────

class _GroupScreen extends StatelessWidget {
  final ContentStore store;
  final GroupObject group;

  const _GroupScreen({required this.store, required this.group});

  @override
  Widget build(BuildContext context) {
    final hasSubGroups = group.groups.isNotEmpty;
    final hasWatchables = group.watchables.isNotEmpty;

    return Scaffold(
      backgroundColor: ZColors.background,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => store.setGroup(group.upperLevel),
        ),
        title: Text(group.name),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(child: Text('${group.totalCount}', style: ZText.bodySm)),
          ),
        ],
      ),
      body: CustomScrollView(
        slivers: [
          if (hasSubGroups) ...[
            const _SliverSectionHeader(title: 'Categories'),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              sliver: SliverGrid(
                delegate: SliverChildBuilderDelegate(
                  (context, i) => _GroupCard(group: group.groups[i], onTap: () => store.setGroup(group.groups[i])),
                  childCount: group.groups.length,
                ),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2, childAspectRatio: 2 / 3,
                  crossAxisSpacing: 8, mainAxisSpacing: 8,
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 16)),
          ],
          if (hasWatchables) ...[
            if (hasSubGroups) const _SliverSectionHeader(title: 'Items'),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              sliver: SliverGrid(
                delegate: SliverChildBuilderDelegate(
                  (context, i) => _ContentCard(
                    item: group.watchables[i],
                    onToggleFavorite: () => store.toggleFavorite(group.watchables[i]),
                  ),
                  childCount: group.watchables.length,
                ),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2, childAspectRatio: 2 / 3,
                  crossAxisSpacing: 8, mainAxisSpacing: 8,
                ),
              ),
            ),
          ],
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
    );
  }
}

class _SliverSectionHeader extends StatelessWidget {
  final String title;
  const _SliverSectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: Text(title.toUpperCase(), style: ZText.labelUpper),
      ),
    );
  }
}

// ── Group card ────────────────────────────────────────────────────────────────

class _GroupCard extends StatelessWidget {
  final GroupObject group;
  final VoidCallback onTap;

  const _GroupCard({required this.group, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final covers = group.getImageList(9);

    return GestureDetector(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  covers.isNotEmpty ? _CoverCollage(covers: covers) : const _GroupFallback(),
                  Positioned(
                    top: 6, right: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text('${group.totalCount}', style: ZText.body(11)),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(group.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: ZText.body(12, weight: FontWeight.w500)),
          if (group.groups.isNotEmpty)
            Text('${group.groups.length} subgroups', style: ZText.bodySm),
        ],
      ),
    );
  }
}

class _CoverCollage extends StatelessWidget {
  final List<CoverItem> covers;
  const _CoverCollage({required this.covers});

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3, crossAxisSpacing: 1, mainAxisSpacing: 1,
      ),
      itemCount: 9,
      itemBuilder: (context, i) {
        if (i < covers.length && covers[i].logo.isNotEmpty) {
          return Image.network(covers[i].logo, fit: BoxFit.cover,
              errorBuilder: (context, error, stack) => const _CollageCell());
        }
        return const _CollageCell();
      },
    );
  }
}

class _CollageCell extends StatelessWidget {
  const _CollageCell();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: ZColors.secondary,
      child: const Icon(Icons.folder_outlined, color: ZColors.border, size: 16),
    );
  }
}

class _GroupFallback extends StatelessWidget {
  const _GroupFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: [ZColors.secondary, ZColors.background],
        ),
      ),
      child: const Icon(Icons.folder_outlined, color: ZColors.border, size: 48),
    );
  }
}

// ── Content card ──────────────────────────────────────────────────────────────

class _ContentCard extends StatelessWidget {
  final WatchableObject item;
  final VoidCallback onToggleFavorite;

  const _ContentCard({required this.item, required this.onToggleFavorite});

  @override
  Widget build(BuildContext context) {
    final isFavorite = item.userData.favorite?.value ?? false;
    final progress = item.userData.watchProgress;
    final progressPercent = progress != null ? (progress.progress * 100).clamp(0.0, 100.0) : 0.0;
    final isWatched = progress?.watched != null;

    return GestureDetector(
      onTap: () { /* TODO: wire to player */ },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  item.logo.isNotEmpty
                      ? Image.network(item.logo, fit: BoxFit.cover,
                          errorBuilder: (context, error, stack) => _ContentFallback(category: item.category))
                      : _ContentFallback(category: item.category),

                  // Category badge
                  Positioned(
                    top: 6, right: 6,
                    child: _CategoryBadge(category: item.category),
                  ),

                  // Favorite button
                  Positioned(
                    top: 2, left: 2,
                    child: GestureDetector(
                      onTap: onToggleFavorite,
                      behavior: HitTestBehavior.opaque,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.5),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isFavorite ? Icons.star : Icons.star_border,
                          color: isFavorite ? ZColors.primary : ZColors.mutedForeground,
                          size: 16,
                        ),
                      ),
                    ),
                  ),

                  // Year badge
                  if (item.year != null)
                    Positioned(
                      bottom: progressPercent > 0 ? 6 : 4, left: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.7),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: Text('${item.year}', style: ZText.body(10)),
                      ),
                    ),

                  // Watched checkmark
                  if (isWatched)
                    Positioned(
                      bottom: progressPercent > 0 ? 6 : 4, right: 6,
                      child: Container(
                        width: 20, height: 20,
                        decoration: const BoxDecoration(color: ZColors.successFg, shape: BoxShape.circle),
                        child: const Icon(Icons.check, color: ZColors.success, size: 12),
                      ),
                    ),

                  // Progress bar
                  if (progressPercent > 0 && progressPercent < 95)
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
          Text(item.name, maxLines: 2, overflow: TextOverflow.ellipsis,
              style: ZText.body(12, weight: FontWeight.w500)),
          if (item.group.isNotEmpty)
            Text(item.group, maxLines: 1, overflow: TextOverflow.ellipsis, style: ZText.bodySm),
        ],
      ),
    );
  }
}

class _ContentFallback extends StatelessWidget {
  final M3UCategory category;
  const _ContentFallback({required this.category});

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
          begin: Alignment.topLeft, end: Alignment.bottomRight,
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
      child: Text(label, style: ZText.body(9, weight: FontWeight.w800, color: ZColors.background)),
    );
  }
}
