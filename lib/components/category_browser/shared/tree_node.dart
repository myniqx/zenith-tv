import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../models/group.dart';
import '../../../stores/content_store.dart';

class TreeNode extends StatefulWidget {
  final GroupObject group;
  final int level;
  final bool isCollapsed;

  const TreeNode({
    super.key,
    required this.group,
    required this.level,
    this.isCollapsed = false,
  });

  @override
  State<TreeNode> createState() => _TreeNodeState();
}

class _TreeNodeState extends State<TreeNode> {
  bool _expanded = false;
  bool _hovered  = false;

  @override
  Widget build(BuildContext context) {
    final store = context.watch<ContentStore>();
    final isSelected = store.currentGroup == widget.group;
    final hasChildren = widget.group.groups.isNotEmpty;

    if (widget.isCollapsed) {
      if (widget.level > 1) return const SizedBox.shrink();
      return Tooltip(
        message: '${widget.group.name} (${widget.group.totalCount})',
        preferBelow: false,
        child: MouseRegion(
          cursor: SystemMouseCursors.click,
          onEnter: (_) => setState(() => _hovered = true),
          onExit:  (_) => setState(() => _hovered = false),
          child: GestureDetector(
            onTap: () {
              store.setGroup(widget.group);
              setState(() => _expanded = !_expanded);
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 120),
              margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: isSelected
                    ? ZColors.primary
                    : _hovered ? ZColors.accent : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                widget.group.listIcon,
                size: 20,
                color: isSelected ? ZColors.primaryForeground : ZColors.mutedForeground,
              ),
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MouseRegion(
          cursor: SystemMouseCursors.click,
          onEnter: (_) => setState(() => _hovered = true),
          onExit:  (_) => setState(() => _hovered = false),
          child: GestureDetector(
            onTap: () {
              store.setGroup(widget.group);
              if (hasChildren) setState(() => _expanded = !_expanded);
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 120),
              margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              padding: EdgeInsets.only(
                left: widget.level * 12.0 + 4,
                right: 8, top: 7, bottom: 7,
              ),
              decoration: BoxDecoration(
                color: isSelected
                    ? ZColors.primary.withValues(alpha: 0.15)
                    : _hovered ? ZColors.accent : Colors.transparent,
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
                  Icon(widget.group.listIcon, size: 15,
                      color: isSelected ? ZColors.primary : ZColors.mutedForeground),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.group.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: ZText.body(13,
                          weight: isSelected ? FontWeight.w600 : FontWeight.w400,
                          color: isSelected ? ZColors.primary : ZColors.foreground),
                    ),
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
        ),
        if (_expanded && hasChildren)
          ...widget.group.groups.map((child) => TreeNode(
                key: ValueKey(child.name),
                group: child,
                level: widget.level + 1,
                isCollapsed: widget.isCollapsed,
              )),
      ],
    );
  }
}
