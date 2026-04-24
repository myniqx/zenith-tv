import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/app_theme.dart';
import '../../models/group.dart';
import '../../stores/content_store.dart';
import 'shared/tree_node.dart';

class CategoryBrowser extends StatelessWidget {
  final bool isCollapsed;

  const CategoryBrowser({super.key, this.isCollapsed = false});

  @override
  Widget build(BuildContext context) {
    final store = context.watch<ContentStore>();

    final rootGroups = [
      (store.movieGroup,    Icons.movie_outlined,       'Movies'),
      (store.tvShowGroup,   Icons.tv,                   'TV Shows'),
      (store.streamGroup,   Icons.radio,                'Live'),
      (store.favoriteGroup, Icons.favorite_outline,     'Favorites'),
      (store.recentGroup,   Icons.history,              'Recent'),
      (store.watchedGroup,  Icons.check_circle_outline, 'Watched'),
    ];

    final isAllSelected = store.currentGroup == null;

    return Container(
      color: ZColors.muted,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isCollapsed)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
              child: Text('CATEGORIES', style: ZText.labelUpper),
            ),

          // All entry
          if (isCollapsed)
            Tooltip(
              message: 'All',
              preferBelow: false,
              child: GestureDetector(
                onTap: () => store.setGroup(null),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: isAllSelected ? ZColors.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.grid_view, size: 20,
                      color: isAllSelected
                          ? ZColors.primaryForeground
                          : ZColors.mutedForeground),
                ),
              ),
            )
          else
            GestureDetector(
              onTap: () => store.setGroup(null),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: isAllSelected ? ZColors.accent : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const SizedBox(width: 24),
                    Icon(Icons.grid_view, size: 15,
                        color: isAllSelected ? ZColors.primary : ZColors.mutedForeground),
                    const SizedBox(width: 8),
                    Text('All',
                        style: ZText.body(13,
                            weight: isAllSelected ? FontWeight.w600 : FontWeight.w400,
                            color: isAllSelected ? ZColors.primary : ZColors.foreground)),
                  ],
                ),
              ),
            ),

          Divider(height: 1, color: ZColors.border.withValues(alpha: 0.15)),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 4),
              children: rootGroups.map((t) => _RootGroupNode(
                    group: t.$1,
                    icon: t.$2,
                    isCollapsed: isCollapsed,
                  )).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

/// Root-level node that shows a fixed icon instead of group.listIcon.
class _RootGroupNode extends StatefulWidget {
  final GroupObject group;
  final IconData icon;
  final bool isCollapsed;

  const _RootGroupNode({
    required this.group,
    required this.icon,
    required this.isCollapsed,
  });

  @override
  State<_RootGroupNode> createState() => _RootGroupNodeState();
}

class _RootGroupNodeState extends State<_RootGroupNode> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final store = context.watch<ContentStore>();
    final isSelected = store.currentGroup == widget.group;
    final hasChildren = widget.group.groups.isNotEmpty;

    if (widget.isCollapsed) {
      return Tooltip(
        message: '${widget.group.name} (${widget.group.totalCount})',
        preferBelow: false,
        child: GestureDetector(
          onTap: () {
            store.setGroup(widget.group);
            setState(() => _expanded = !_expanded);
          },
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isSelected ? ZColors.primary : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(widget.icon, size: 20,
                color: isSelected ? ZColors.primaryForeground : ZColors.mutedForeground),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () {
            store.setGroup(widget.group);
            if (hasChildren) setState(() => _expanded = !_expanded);
          },
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
            padding: const EdgeInsets.only(left: 4, right: 8, top: 7, bottom: 7),
            decoration: BoxDecoration(
              color: isSelected ? ZColors.accent : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                SizedBox(
                  width: 20,
                  child: hasChildren
                      ? Icon(
                          _expanded ? Icons.expand_more : Icons.chevron_right,
                          size: 16,
                          color: isSelected ? ZColors.primary : ZColors.mutedForeground,
                        )
                      : null,
                ),
                const SizedBox(width: 4),
                Icon(widget.icon, size: 15,
                    color: isSelected ? ZColors.primary : ZColors.mutedForeground),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(widget.group.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: ZText.body(13,
                          weight: isSelected ? FontWeight.w600 : FontWeight.w400,
                          color: isSelected ? ZColors.primary : ZColors.foreground)),
                ),
                if (widget.group.totalCount > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? ZColors.primary.withValues(alpha: 0.2)
                          : ZColors.secondary,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text('${widget.group.totalCount}',
                        style: ZText.body(10,
                            color: isSelected ? ZColors.primary : ZColors.mutedForeground)),
                  ),
              ],
            ),
          ),
        ),
        if (_expanded && hasChildren)
          ...widget.group.groups.map((child) => TreeNode(
                key: ValueKey(child.name),
                group: child,
                level: 2,
                isCollapsed: widget.isCollapsed,
              )),
      ],
    );
  }
}
