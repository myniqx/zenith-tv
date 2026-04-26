import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/content_store.dart';
import '../../../stores/media_player_store.dart';
import '../../../stores/settings_store.dart';
import '../../../stores/universal_player_store.dart';
import '../../../components/category_browser/category_browser.dart';
import '../../../components/content_grid/content_grid.dart';
import '../../../components/p2p/p2p_panel.dart';
import '../../../components/profile_manager/profile_manager.dart';
import '../../../components/settings/shared/settings_panel.dart';
import '../../../components/toolbar/toolbar.dart';
import '../../../components/video_player/tablet/video_player_tablet.dart';

// Divider hit area and visible thickness
const double _dividerHitArea  = 12;
const double _dividerVisible  = 3;
const double _categoryMin     = 0;
const double _categoryMax     = 480;
const double _videoMin        = 0;
const double _videoMax        = 600;

class AppShellTablet extends StatefulWidget {
  const AppShellTablet({super.key});

  @override
  State<AppShellTablet> createState() => _AppShellTabletState();
}

class _AppShellTabletState extends State<AppShellTablet> {
  VideoController? _videoController;

  VideoController _getOrCreateController(MediaPlayerStore store) {
    return _videoController ??= VideoController(
      store.player,
      configuration: const VideoControllerConfiguration(
        enableHardwareAcceleration: true,
      ),
    );
  }

  void _closePlayer() => context.read<UniversalPlayerStore>().close();

  @override
  Widget build(BuildContext context) {
    final contentStore  = context.watch<ContentStore>();
    final playerStore   = context.watch<UniversalPlayerStore>();
    final settings      = context.watch<SettingsStore>();
    final mediaStore    = context.read<MediaPlayerStore>();
    final controller    = _getOrCreateController(mediaStore);
    final hasPlayer     = playerStore.currentItem != null;

    return Scaffold(
      backgroundColor: ZColors.background,
      body: Column(
        children: [
          _TabletHeader(
            categoryCollapsed: settings.categoryWidth == 0,
            onToggleCategory: () {
              final w = settings.categoryWidth == 0
                  ? SettingsStore.defaultCategoryWidth
                  : 0.0;
              settings.setLayoutWidths(category: w, forceWrite: true);
            },
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
            child: _ResizableLayout(
              categoryWidth : settings.categoryWidth,
              videoWidth    : hasPlayer ? settings.videoWidth : 0,
              onCategoryResize: (w) => settings.setLayoutWidths(category: w),
              onVideoResize   : (w) => settings.setLayoutWidths(video: w),
              categoryChild : const CategoryBrowser(),
              contentChild  : const ContentGrid(),
              videoChild    : VideoPlayerTablet(
                player    : mediaStore.player,
                controller: controller,
                onClose   : _closePlayer,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Manual 3-column resizable layout ─────────────────────────────────────────
//
// Col-0 (category) | Divider-A | Col-1 (content, expands) | Divider-B | Col-2 (video)
//
// Dragging Divider-A: only col-0 width changes (col-1 absorbs the slack).
// Dragging Divider-B: only col-2 width changes (col-1 absorbs the slack).

class _ResizableLayout extends StatelessWidget {
  final double categoryWidth;
  final double videoWidth;
  final ValueChanged<double> onCategoryResize;
  final ValueChanged<double> onVideoResize;
  final Widget categoryChild;
  final Widget contentChild;
  final Widget videoChild;

  const _ResizableLayout({
    required this.categoryWidth,
    required this.videoWidth,
    required this.onCategoryResize,
    required this.onVideoResize,
    required this.categoryChild,
    required this.contentChild,
    required this.videoChild,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        // Col-0: category
        if (categoryWidth > 0)
          SizedBox(width: categoryWidth, child: categoryChild),

        // Divider-A (between category and content)
        _Divider(
          onDelta: (dx) {
            final next = (categoryWidth + dx).clamp(_categoryMin, _categoryMax);
            onCategoryResize(next);
          },
        ),

        // Col-1: content (expands)
        Expanded(child: contentChild),

        // Divider-B (between content and video) — only shown when video is open
        if (videoWidth > 0)
          _Divider(
            onDelta: (dx) {
              final next = (videoWidth - dx).clamp(_videoMin, _videoMax);
              onVideoResize(next);
            },
          ),

        // Col-2: video
        if (videoWidth > 0)
          SizedBox(width: videoWidth, child: videoChild),
      ],
    );
  }
}

class _Divider extends StatefulWidget {
  final ValueChanged<double> onDelta;
  const _Divider({required this.onDelta});

  @override
  State<_Divider> createState() => _DividerState();
}

class _DividerState extends State<_Divider> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.resizeColumn,
      onEnter: (_) => setState(() => _hovered = true),
      onExit:  (_) => setState(() => _hovered = false),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onHorizontalDragUpdate: (d) => widget.onDelta(d.delta.dx),
        child: SizedBox(
          width: _dividerHitArea,
          child: Center(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: _dividerVisible,
              color: _hovered
                  ? ZColors.primary.withValues(alpha: 0.6)
                  : ZColors.border.withValues(alpha: 0.25),
            ),
          ),
        ),
      ),
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
          const _HeaderCapsule(),
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
      onExit:  (_) => setState(() => _hovered = false),
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
              Icon(widget.icon, size: 16,
                  color: _hovered ? ZColors.foreground : ZColors.mutedForeground),
              const SizedBox(width: 6),
              Text(widget.label,
                  style: ZText.body(12,
                      weight: FontWeight.w600,
                      color: _hovered ? ZColors.foreground : ZColors.mutedForeground)),
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

  void _openDialog(BuildContext context, String title, Widget child,
      {double width = 600}) {
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
                      child: const Icon(Icons.close,
                          size: 20, color: ZColors.mutedForeground),
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
      (Icons.cell_tower_rounded,  'P2P',      () => _openDialog(context, 'Remote Control', const P2PPanel(), width: 680)),
      (Icons.settings_outlined,   'Settings', () => _openDialog(context, 'Settings',
          const SingleChildScrollView(child: SettingsPanel()))),
      (Icons.person_outline, 'Profiles', () {
        final outerCtx = context;
        _openDialog(
          outerCtx,
          'Profiles',
          ProfileManager(onLoaded: () => Navigator.of(outerCtx).pop()),
          width: 760,
        );
      }),
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
                Container(width: 1, height: 20,
                    color: ZColors.border.withValues(alpha: 0.4)),
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
