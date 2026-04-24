import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/content_store.dart';
import '../../../components/category_browser/category_browser.dart';
import '../../../components/content_grid/content_grid.dart';
import '../../../components/p2p/p2p_panel.dart';
import '../../../components/profile_manager/profile_manager.dart';
import '../../../components/settings/shared/settings_panel.dart';
import '../../../components/toolbar/toolbar.dart';

class AppShellTablet extends StatefulWidget {
  const AppShellTablet({super.key});

  @override
  State<AppShellTablet> createState() => _AppShellTabletState();
}

class _AppShellTabletState extends State<AppShellTablet> {
  double _categoryWidth = 200;
  bool _categoryCollapsed = false;

  static const _minCategoryWidth = 140.0;
  static const _maxCategoryWidth = 480.0;

  void _toggleCategory() =>
      setState(() => _categoryCollapsed = !_categoryCollapsed);

  @override
  Widget build(BuildContext context) {
    final contentStore = context.watch<ContentStore>();

    return Scaffold(
      backgroundColor: ZColors.background,
      body: Column(
        children: [
          _TabletHeader(
            categoryCollapsed: _categoryCollapsed,
            onToggleCategory: _toggleCategory,
          ),
          if (contentStore.isLoading)
            LinearProgressIndicator(
              value: contentStore.loadProgress > 0
                  ? contentStore.loadProgress
                  : null,
              backgroundColor: ZColors.secondary,
              valueColor: const AlwaysStoppedAnimation(ZColors.primary),
              minHeight: 2,
            ),
          const Toolbar(),
          Expanded(
            child: _ContentLayout(
              categoryWidth: _categoryCollapsed ? 0 : _categoryWidth,
              onCategoryResize: (w) => setState(() => _categoryWidth = w),
              minCategoryWidth: _minCategoryWidth,
              maxCategoryWidth: _maxCategoryWidth,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Content layout ────────────────────────────────────────────────────────────

class _ContentLayout extends StatefulWidget {
  final double categoryWidth;
  final ValueChanged<double> onCategoryResize;
  final double minCategoryWidth;
  final double maxCategoryWidth;

  const _ContentLayout({
    required this.categoryWidth,
    required this.onCategoryResize,
    required this.minCategoryWidth,
    required this.maxCategoryWidth,
  });

  @override
  State<_ContentLayout> createState() => _ContentLayoutState();
}

class _ContentLayoutState extends State<_ContentLayout> {
  bool _dragging = false;
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final showHandle = _dragging || _hovered;

    return Row(
      children: [
        if (widget.categoryWidth > 0) ...[
          // Animate only when NOT dragging (e.g. collapse toggle)
          _dragging
              ? SizedBox(
                  width: widget.categoryWidth,
                  child: const CategoryBrowser(),
                )
              : AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOutCubic,
                  width: widget.categoryWidth,
                  child: const CategoryBrowser(),
                ),

          // Resize handle
          MouseRegion(
            cursor: SystemMouseCursors.resizeColumn,
            onEnter: (_) => setState(() => _hovered = true),
            onExit: (_) => setState(() => _hovered = false),
            child: GestureDetector(
              onHorizontalDragStart: (_) => setState(() => _dragging = true),
              onHorizontalDragUpdate: (details) {
                final newWidth = (widget.categoryWidth + details.delta.dx)
                    .clamp(widget.minCategoryWidth, widget.maxCategoryWidth);
                widget.onCategoryResize(newWidth);
              },
              onHorizontalDragEnd: (_) => setState(() => _dragging = false),
              child: SizedBox(
                width: 8,
                child: Center(
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 120),
                    width: showHandle ? 3 : 1,
                    color: showHandle
                        ? ZColors.border.withValues(alpha: 0.6)
                        : ZColors.border.withValues(alpha: 0.2),
                  ),
                ),
              ),
            ),
          ),
        ],

        const Expanded(child: ContentGrid()),
      ],
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────────────

class _TabletHeader extends StatelessWidget {
  final bool categoryCollapsed;
  final VoidCallback onToggleCategory;

  const _TabletHeader({
    required this.categoryCollapsed,
    required this.onToggleCategory,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 60,
      decoration: BoxDecoration(
        color: ZColors.secondary.withValues(alpha: 0.7),
        border: Border(
          bottom: BorderSide(color: ZColors.border.withValues(alpha: 0.04)),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        children: [
          // Category toggle
          GestureDetector(
            onTap: onToggleCategory,
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: categoryCollapsed ? ZColors.accent : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.menu,
                size: 18,
                color: categoryCollapsed
                    ? ZColors.primary
                    : ZColors.mutedForeground,
              ),
            ),
          ),
          const SizedBox(width: 16),

          // Logo
          Text(
            'Zenith TV',
            style: GoogleFonts.spaceGrotesk(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              fontStyle: FontStyle.italic,
              letterSpacing: -0.5,
              color: ZColors.foreground,
            ),
          ),

          const Spacer(),

          // Modal buttons
          _HeaderCapsule(),
        ],
      ),
    );
  }
}

// ── Capsule button with hover ─────────────────────────────────────────────────

class _CapsuleButton extends StatefulWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _CapsuleButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  State<_CapsuleButton> createState() => _CapsuleButtonState();
}

class _CapsuleButtonState extends State<_CapsuleButton> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          color: _hovered
              ? Colors.white.withValues(alpha: 0.07)
              : Colors.transparent,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                widget.icon,
                size: 16,
                color: _hovered ? ZColors.foreground : ZColors.mutedForeground,
              ),
              const SizedBox(width: 6),
              Text(
                widget.label,
                style: ZText.body(
                  12,
                  weight: FontWeight.w600,
                  color: _hovered
                      ? ZColors.foreground
                      : ZColors.mutedForeground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Header capsule ────────────────────────────────────────────────────────────

class _HeaderCapsule extends StatelessWidget {
  const _HeaderCapsule();

  void _openDialog(
    BuildContext context,
    String title,
    Widget child, {
    double width = 600,
  }) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: ZColors.background,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: SizedBox(
          width: width,
          height: MediaQuery.of(context).size.height * 0.75,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(title, style: ZText.headline(20)),
                    const Spacer(),
                    GestureDetector(
                      onTap: () => Navigator.pop(ctx),
                      child: const Icon(
                        Icons.close,
                        size: 20,
                        color: ZColors.mutedForeground,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Expanded(child: child),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final buttons = [
      (
        Icons.cell_tower_rounded,
        'P2P',
        () => _openDialog(
          context,
          'Remote Control',
          const P2PPanel(),
          width: 680,
        ),
      ),
      (
        Icons.settings_outlined,
        'Settings',
        () => _openDialog(context, 'Settings', const SettingsPanel()),
      ),
      (
        Icons.person_outline,
        'Profiles',
        () => _openDialog(
          context,
          'Profiles',
          const ProfileManager(),
          width: 760,
        ),
      ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: ZColors.secondary.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.2)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (int i = 0; i < buttons.length; i++) ...[
              if (i > 0)
                Container(
                  width: 1,
                  height: 20,
                  color: ZColors.border.withValues(alpha: 0.4),
                ),
              _CapsuleButton(
                icon: buttons[i].$1,
                label: buttons[i].$2,
                onTap: buttons[i].$3,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
