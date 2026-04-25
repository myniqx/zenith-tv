import 'package:flutter/material.dart';
import 'package:flutter_resizable_container/flutter_resizable_container.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/content_store.dart';
import '../../../stores/media_player_store.dart';
import '../../../stores/universal_player_store.dart';
import '../../../components/category_browser/category_browser.dart';
import '../../../components/content_grid/content_grid.dart';
import '../../../components/p2p/p2p_panel.dart';
import '../../../components/profile_manager/profile_manager.dart';
import '../../../components/settings/shared/settings_panel.dart';
import '../../../components/toolbar/toolbar.dart';
import '../../../components/video_player/tablet/video_player_tablet.dart';

class AppShellTablet extends StatefulWidget {
  const AppShellTablet({super.key});

  @override
  State<AppShellTablet> createState() => _AppShellTabletState();
}

class _AppShellTabletState extends State<AppShellTablet> {
  bool _categoryCollapsed = false;
  VideoController? _videoController;
  late final ResizableController _resizableCtrl;

  @override
  void initState() {
    super.initState();
    _resizableCtrl = ResizableController();
  }

  @override
  void dispose() {
    _resizableCtrl.dispose();
    super.dispose();
  }

  VideoController _getOrCreateController(MediaPlayerStore store) {
    return _videoController ??= VideoController(
      store.player,
      configuration: const VideoControllerConfiguration(
        enableHardwareAcceleration: true,
      ),
    );
  }

  void _toggleCategory() {
    setState(() => _categoryCollapsed = !_categoryCollapsed);
  }

  void _closePlayer() => context.read<UniversalPlayerStore>().close();

  @override
  Widget build(BuildContext context) {
    final contentStore = context.watch<ContentStore>();
    final playerStore = context.watch<UniversalPlayerStore>();
    final mediaStore = context.read<MediaPlayerStore>();
    final controller = _getOrCreateController(mediaStore);
    final hasPlayer = playerStore.currentItem != null;

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
            child: ResizableContainer(
              controller: _resizableCtrl,
              direction: Axis.horizontal,
              children: [
                // Category panel
                ResizableChild(
                  size: ResizableSize.pixels(
                    _categoryCollapsed ? 0 : 200,
                    min: 0,
                    max: 480,
                  ),
                  divider: ResizableDivider(
                    thickness: 1,
                    color: ZColors.border.withValues(alpha: 0.25),
                    cursor: SystemMouseCursors.resizeColumn,
                  ),
                  child: const CategoryBrowser(),
                ),

                // Content grid
                const ResizableChild(
                  size: ResizableSize.expand(),
                  child: ContentGrid(),
                ),

                // Video panel — always in tree, 0px when no player
                ResizableChild(
                  size: ResizableSize.pixels(
                    hasPlayer ? 360 : 0,
                    min: 0,
                    max: 600,
                  ),
                  divider: ResizableDivider(
                    thickness: 1,
                    color: ZColors.border.withValues(alpha: 0.25),
                    cursor: SystemMouseCursors.resizeColumn,
                  ),
                  child: VideoPlayerTablet(
                    player: mediaStore.player,
                    controller: controller,
                    onClose: _closePlayer,
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
