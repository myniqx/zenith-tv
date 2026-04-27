import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../core/tv_focus.dart';
import '../../../stores/content_store.dart';
import '../../p2p/p2p_screen.dart';
import '../../profile/profile_screen.dart';
import '../../content/content_screen.dart';
import '../app_section.dart';

class AppShellTv extends StatefulWidget {
  const AppShellTv({super.key});

  @override
  State<AppShellTv> createState() => _AppShellTvState();
}

class _AppShellTvState extends State<AppShellTv> {
  AppSection _section = AppSection.profile;

  void _navigate(AppSection section) => setState(() => _section = section);

  Widget _buildContent() {
    switch (_section) {
      case AppSection.content:   return const ContentScreen();
      case AppSection.favorites: return const _Placeholder(label: 'Favorites');
      case AppSection.p2p:       return const P2PScreen();
      case AppSection.profile:   return const ProfileScreen();
      case AppSection.settings:  return const _Placeholder(label: 'Settings');
    }
  }

  @override
  Widget build(BuildContext context) {
    final contentStore = context.watch<ContentStore>();

    if (contentStore.justLoaded) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          contentStore.justLoaded = false;
          setState(() => _section = AppSection.content);
        }
      });
    }

    final loadingBanner = contentStore.isLoading
        ? LinearProgressIndicator(
            value: contentStore.loadProgress > 0 ? contentStore.loadProgress : null,
            backgroundColor: ZColors.secondary,
            valueColor: const AlwaysStoppedAnimation(ZColors.primary),
            minHeight: 2,
          )
        : const SizedBox.shrink();

    if (!contentStore.isReady) {
      return Scaffold(
        backgroundColor: ZColors.background,
        body: Column(children: [
          loadingBanner,
          Expanded(child: Row(children: [
            const Expanded(child: ProfileScreen()),
            Container(width: 1, color: ZColors.border.withValues(alpha: 0.2)),
            const Expanded(child: P2PScreen()),
          ])),
        ]),
      );
    }

    return TvFocusScope(
      child: Scaffold(
        backgroundColor: ZColors.background,
        body: Column(children: [
          _TvHeader(section: _section, onNavigate: _navigate),
          loadingBanner,
          Expanded(child: _buildContent()),
        ]),
      ),
    );
  }
}

class _TvHeader extends StatelessWidget {
  final AppSection section;
  final void Function(AppSection) onNavigate;

  const _TvHeader({required this.section, required this.onNavigate});

  static const _navItems = [
    (AppSection.content,   'Content'),
    (AppSection.favorites, 'Favorites'),
    (AppSection.p2p,       'P2P'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 72,
      decoration: BoxDecoration(
        color: ZColors.secondary.withValues(alpha: 0.7),
        border: Border(bottom: BorderSide(color: ZColors.border.withValues(alpha: 0.04))),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 48),
      child: Row(
        children: [
          Text(
            'Zenith TV',
            style: GoogleFonts.spaceGrotesk(
              fontSize: 24, fontWeight: FontWeight.w900,
              fontStyle: FontStyle.italic, letterSpacing: -0.5,
              color: ZColors.foreground,
            ),
          ),
          const SizedBox(width: 48),
          Row(
            children: _navItems.map((item) => TvFocusable(
              onSelect: () => onNavigate(item.$1),
              builder: (context, focused) => Container(
                margin: const EdgeInsets.only(right: 4),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                decoration: BoxDecoration(
                  color: focused
                      ? ZColors.accent
                      : section == item.$1
                          ? ZColors.primary.withValues(alpha: 0.12)
                          : Colors.transparent,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  item.$2.toUpperCase(),
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: 1.2,
                    color: focused || section == item.$1
                        ? ZColors.primary
                        : ZColors.mutedForeground,
                  ),
                ),
              ),
            )).toList(),
          ),
          const Spacer(),
          _TvHeaderCapsule(section: section, onNavigate: onNavigate),
        ],
      ),
    );
  }
}

class _TvHeaderCapsule extends StatelessWidget {
  final AppSection section;
  final void Function(AppSection) onNavigate;

  const _TvHeaderCapsule({required this.section, required this.onNavigate});

  @override
  Widget build(BuildContext context) {
    final buttons = [
      (Icons.cell_tower_rounded, 'P2P',      AppSection.p2p),
      (Icons.settings_outlined,  'Settings', AppSection.settings),
      (Icons.person_outline,     'Profile',  AppSection.profile),
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
                Container(width: 1, height: 20, color: ZColors.border.withValues(alpha: 0.4)),
              TvFocusable(
                onSelect: () => onNavigate(buttons[i].$3),
                builder: (context, focused) {
                  final isActive = section == buttons[i].$3;
                  return Container(
                    color: focused || isActive
                        ? Colors.white.withValues(alpha: 0.1)
                        : Colors.transparent,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(buttons[i].$1, size: 18,
                            color: focused || isActive
                                ? ZColors.primary
                                : ZColors.mutedForeground),
                        const SizedBox(width: 6),
                        Text(buttons[i].$2,
                            style: ZText.body(13, weight: FontWeight.w600,
                                color: focused || isActive
                                    ? ZColors.primary
                                    : ZColors.mutedForeground)),
                      ],
                    ),
                  );
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Placeholder extends StatelessWidget {
  final String label;
  const _Placeholder({required this.label});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text('$label — coming soon',
          style: ZText.body(18, color: ZColors.mutedForeground)),
    );
  }
}
