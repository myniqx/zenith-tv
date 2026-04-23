import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app_theme.dart';

// ── TvFocusable ───────────────────────────────────────────────────────────────
// navix Button karşılığı. Focus alınca accent highlight + scale animasyonu.
// onKeyEvent ile d-pad yönlendirmesi desteklenir.

class TvFocusable extends StatefulWidget {
  final Widget Function(BuildContext context, bool focused) builder;
  final VoidCallback? onSelect;
  final FocusNode? focusNode;
  final bool autofocus;

  const TvFocusable({
    super.key,
    required this.builder,
    this.onSelect,
    this.focusNode,
    this.autofocus = false,
  });

  @override
  State<TvFocusable> createState() => _TvFocusableState();
}

class _TvFocusableState extends State<TvFocusable>
    with SingleTickerProviderStateMixin {
  late final FocusNode _node;
  bool _focused = false;
  late final AnimationController _ctrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _node = widget.focusNode ?? FocusNode();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    );
    _scale = Tween(begin: 0.95, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    if (widget.focusNode == null) _node.dispose();
    _ctrl.dispose();
    super.dispose();
  }

  void _onFocusChange(bool focused) {
    setState(() => _focused = focused);
    if (focused) {
      _ctrl.forward();
    } else {
      _ctrl.reverse();
    }
  }

  KeyEventResult _onKeyEvent(FocusNode node, KeyEvent event) {
    if (event is KeyDownEvent) {
      if (event.logicalKey == LogicalKeyboardKey.select ||
          event.logicalKey == LogicalKeyboardKey.enter ||
          event.logicalKey == LogicalKeyboardKey.gameButtonA) {
        widget.onSelect?.call();
        return KeyEventResult.handled;
      }
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    return Focus(
      focusNode: _node,
      autofocus: widget.autofocus,
      onFocusChange: _onFocusChange,
      onKeyEvent: _onKeyEvent,
      child: GestureDetector(
        onTap: widget.onSelect,
        child: ScaleTransition(
          scale: _scale,
          child: widget.builder(context, _focused),
        ),
      ),
    );
  }
}

// ── TvButton ──────────────────────────────────────────────────────────────────
// Hazır kullanım için TvFocusable sarmalı — design token stilinde.

class TvButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onSelect;
  final bool autofocus;
  final bool isActive;

  const TvButton({
    super.key,
    required this.label,
    this.icon,
    this.onSelect,
    this.autofocus = false,
    this.isActive = false,
  });

  @override
  Widget build(BuildContext context) {
    return TvFocusable(
      autofocus: autofocus,
      onSelect: onSelect,
      builder: (context, focused) {
        final highlighted = focused || isActive;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          decoration: BoxDecoration(
            color: focused
                ? ZColors.accent
                : isActive
                    ? ZColors.primary.withValues(alpha: 0.15)
                    : Colors.transparent,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: highlighted
                  ? ZColors.primary.withValues(alpha: 0.5)
                  : Colors.transparent,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18,
                    color: highlighted ? ZColors.primary : ZColors.mutedForeground),
                const SizedBox(width: 8),
              ],
              Text(
                label,
                style: ZText.body(14,
                    weight: FontWeight.w600,
                    color: highlighted ? ZColors.primary : ZColors.mutedForeground),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ── TvVerticalList ────────────────────────────────────────────────────────────
// navix VerticalList karşılığı. Yukarı/aşağı ok ile focus traverse eder.

class TvVerticalList extends StatelessWidget {
  final List<Widget> children;
  final ScrollController? scrollController;
  final EdgeInsetsGeometry padding;

  const TvVerticalList({
    super.key,
    required this.children,
    this.scrollController,
    this.padding = const EdgeInsets.all(0),
  });

  @override
  Widget build(BuildContext context) {
    return FocusTraversalGroup(
      policy: OrderedTraversalPolicy(),
      child: ListView(
        controller: scrollController,
        padding: padding,
        children: children,
      ),
    );
  }
}

// ── TvHorizontalList ──────────────────────────────────────────────────────────
// navix HorizontalList karşılığı. Sağ/sol ok ile focus traverse eder.

class TvHorizontalList extends StatelessWidget {
  final List<Widget> children;
  final MainAxisAlignment mainAxisAlignment;
  final CrossAxisAlignment crossAxisAlignment;

  const TvHorizontalList({
    super.key,
    required this.children,
    this.mainAxisAlignment = MainAxisAlignment.start,
    this.crossAxisAlignment = CrossAxisAlignment.center,
  });

  @override
  Widget build(BuildContext context) {
    return FocusTraversalGroup(
      policy: OrderedTraversalPolicy(),
      child: Row(
        mainAxisAlignment: mainAxisAlignment,
        crossAxisAlignment: crossAxisAlignment,
        children: children,
      ),
    );
  }
}

// ── TvGrid ────────────────────────────────────────────────────────────────────
// navix PaginatedGrid karşılığı. Grid içinde d-pad navigasyonu.

class TvGrid extends StatelessWidget {
  final int crossAxisCount;
  final List<Widget> children;
  final double spacing;
  final EdgeInsetsGeometry padding;

  const TvGrid({
    super.key,
    required this.crossAxisCount,
    required this.children,
    this.spacing = 12,
    this.padding = const EdgeInsets.all(0),
  });

  @override
  Widget build(BuildContext context) {
    return FocusTraversalGroup(
      policy: OrderedTraversalPolicy(),
      child: Padding(
        padding: padding,
        child: Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: children.map((child) => SizedBox(
            width: _itemWidth(context),
            child: child,
          )).toList(),
        ),
      ),
    );
  }

  double _itemWidth(BuildContext context) {
    final total = MediaQuery.of(context).size.width -
        (padding as EdgeInsets).horizontal -
        spacing * (crossAxisCount - 1);
    return total / crossAxisCount;
  }
}

// ── TvFocusScope ──────────────────────────────────────────────────────────────
// navix FocusRoot/FocusScope karşılığı. Ekran geçişlerinde focus izolasyonu.

class TvFocusScope extends StatelessWidget {
  final Widget child;
  final bool autofocus;

  const TvFocusScope({
    super.key,
    required this.child,
    this.autofocus = true,
  });

  @override
  Widget build(BuildContext context) {
    return FocusScope(
      autofocus: autofocus,
      child: FocusTraversalGroup(
        policy: ReadingOrderTraversalPolicy(),
        child: child,
      ),
    );
  }
}
