import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/app_theme.dart';
import '../../core/tv_focus.dart';
import '../../core/device_type.dart';
import '../../stores/content_store.dart';
import '../p2p/p2p_screen.dart';
import '../profile/profile_screen.dart';
import '../content/content_screen.dart';

enum AppSection { content, favorites, p2p, profile, settings }

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
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

    switch (DeviceTypeDetector.current) {
      case DeviceType.phone:
        return _PhoneShell(
          section: _section, onNavigate: _navigate,
          isReady: contentStore.isReady,
          loadingBanner: loadingBanner, content: _buildContent(),
        );
      case DeviceType.tablet:
        return _TabletShell(
          section: _section, onNavigate: _navigate,
          isReady: contentStore.isReady,
          loadingBanner: loadingBanner, content: _buildContent(),
        );
      case DeviceType.tv:
        return _TVShell(
          section: _section, onNavigate: _navigate,
          isReady: contentStore.isReady,
          loadingBanner: loadingBanner, content: _buildContent(),
        );
    }
  }
}

// ── Phone shell ───────────────────────────────────────────────────────────────

class _PhoneShell extends StatelessWidget {
  final AppSection section;
  final void Function(AppSection) onNavigate;
  final bool isReady;
  final Widget content;
  final Widget loadingBanner;

  const _PhoneShell({
    required this.section, required this.onNavigate,
    required this.isReady, required this.content, required this.loadingBanner,
  });

  static const _tabs = [
    AppSection.content, AppSection.favorites,
    AppSection.p2p, AppSection.profile, AppSection.settings,
  ];

  int get _index => _tabs.indexOf(section).clamp(0, _tabs.length - 1);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ZColors.background,
      body: Column(children: [loadingBanner, Expanded(child: content)]),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: ZColors.muted,
          border: Border(top: BorderSide(color: ZColors.border.withValues(alpha: 0.1))),
        ),
        child: BottomNavigationBar(
          currentIndex: _index,
          backgroundColor: Colors.transparent,
          elevation: 0,
          onTap: (i) {
            final target = _tabs[i];
            if (!isReady && (target == AppSection.content || target == AppSection.favorites)) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Select a profile first'), duration: Duration(seconds: 2)),
              );
              return;
            }
            onNavigate(target);
          },
          selectedItemColor: ZColors.primary,
          unselectedItemColor: ZColors.mutedForeground,
          type: BottomNavigationBarType.fixed,
          selectedLabelStyle: ZText.body(11, weight: FontWeight.w700),
          unselectedLabelStyle: ZText.body(11),
          items: [
            BottomNavigationBarItem(
              icon: Icon(Icons.tv, color: !isReady ? ZColors.border : null),
              label: 'Content',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.star, color: !isReady ? ZColors.border : null),
              label: 'Favorites',
            ),
            const BottomNavigationBarItem(icon: Icon(Icons.cell_tower_rounded), label: 'P2P'),
            const BottomNavigationBarItem(icon: Icon(Icons.person_outline), label: 'Profile'),
            const BottomNavigationBarItem(icon: Icon(Icons.settings_outlined), label: 'Settings'),
          ],
        ),
      ),
    );
  }
}

// ── Tablet shell ──────────────────────────────────────────────────────────────

class _TabletShell extends StatelessWidget {
  final AppSection section;
  final void Function(AppSection) onNavigate;
  final bool isReady;
  final Widget content;
  final Widget loadingBanner;

  const _TabletShell({
    required this.section, required this.onNavigate,
    required this.isReady, required this.content, required this.loadingBanner,
  });

  @override
  Widget build(BuildContext context) {
    if (!isReady) {
      return Scaffold(
        backgroundColor: ZColors.background,
        body: Column(children: [
          loadingBanner,
          Expanded(child: Row(children: [
            const Expanded(child: ProfileScreen()),
            const _VerticalDivider(),
            const Expanded(child: P2PScreen()),
          ])),
        ]),
      );
    }
    return Scaffold(
      backgroundColor: ZColors.background,
      body: Column(children: [
        _TopHeader(section: section, onNavigate: onNavigate),
        loadingBanner,
        Expanded(child: content),
      ]),
    );
  }
}

// ── TV shell ──────────────────────────────────────────────────────────────────

class _TVShell extends StatelessWidget {
  final AppSection section;
  final void Function(AppSection) onNavigate;
  final bool isReady;
  final Widget content;
  final Widget loadingBanner;

  const _TVShell({
    required this.section, required this.onNavigate,
    required this.isReady, required this.content, required this.loadingBanner,
  });

  @override
  Widget build(BuildContext context) {
    if (!isReady) {
      return Scaffold(
        backgroundColor: ZColors.background,
        body: Column(children: [
          loadingBanner,
          Expanded(child: Row(children: [
            const Expanded(child: ProfileScreen()),
            const _VerticalDivider(),
            const Expanded(child: P2PScreen()),
          ])),
        ]),
      );
    }
    return TvFocusScope(
      child: Scaffold(
        backgroundColor: ZColors.background,
        body: Column(children: [
          _TopHeader(section: section, onNavigate: onNavigate, isTV: true),
          loadingBanner,
          Expanded(child: content),
        ]),
      ),
    );
  }
}

// ── Top header — glass effect, Tizen style ────────────────────────────────────

class _TopHeader extends StatelessWidget {
  final AppSection section;
  final void Function(AppSection) onNavigate;
  final bool isTV;

  const _TopHeader({
    required this.section,
    required this.onNavigate,
    this.isTV = false,
  });

  static const _navSections = [
    (AppSection.content,   'Content'),
    (AppSection.favorites, 'Favorites'),
    (AppSection.p2p,       'P2P'),
  ];

  @override
  Widget build(BuildContext context) {
    final px = isTV ? 48.0 : 24.0;
    final height = isTV ? 72.0 : 60.0;

    return Container(
      height: height,
      decoration: BoxDecoration(
        color: ZColors.secondary.withValues(alpha: 0.7),
        border: Border(bottom: BorderSide(color: ZColors.border.withValues(alpha: 0.04))),
      ),
      padding: EdgeInsets.symmetric(horizontal: px),
      child: Row(
        children: [
          // Zenith TV — italic headline, same as Tizen
          Text(
            'Zenith TV',
            style: GoogleFonts.spaceGrotesk(
              fontSize: isTV ? 24 : 20,
              fontWeight: FontWeight.w900,
              fontStyle: FontStyle.italic,
              letterSpacing: -0.5,
              color: ZColors.foreground,
            ),
          ),
          SizedBox(width: isTV ? 48.0 : 32.0),

          // Nav tabs
          Row(
            children: _navSections.map((s) => _NavTab(
              label: s.$2,
              isActive: section == s.$1,
              isTV: isTV,
              onTap: () => onNavigate(s.$1),
            )).toList(),
          ),

          const Spacer(),

          // Right capsule — profile + settings
          _HeaderCapsule(
            section: section,
            onNavigate: onNavigate,
            isTV: isTV,
          ),
        ],
      ),
    );
  }
}

class _NavTab extends StatelessWidget {
  final String label;
  final bool isActive;
  final bool isTV;
  final VoidCallback onTap;

  const _NavTab({
    required this.label, required this.isActive,
    required this.onTap, this.isTV = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isTV) {
      return TvFocusable(
        onSelect: onTap,
        builder: (context, focused) => Container(
          margin: const EdgeInsets.only(right: 4),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          decoration: BoxDecoration(
            color: focused
                ? ZColors.accent
                : isActive
                    ? ZColors.primary.withValues(alpha: 0.12)
                    : Colors.transparent,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label.toUpperCase(),
            style: GoogleFonts.spaceGrotesk(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: focused || isActive ? ZColors.primary : ZColors.mutedForeground,
            ),
          ),
        ),
      );
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? ZColors.accent : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label.toUpperCase(),
          style: GoogleFonts.spaceGrotesk(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
            color: isActive ? ZColors.primary : ZColors.mutedForeground,
          ),
        ),
      ),
    );
  }
}

class _HeaderCapsule extends StatelessWidget {
  final AppSection section;
  final void Function(AppSection) onNavigate;
  final bool isTV;

  const _HeaderCapsule({
    required this.section, required this.onNavigate, required this.isTV,
  });

  @override
  Widget build(BuildContext context) {
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
            _CapsuleButton(
              icon: Icons.cell_tower_rounded,
              label: 'P2P',
              isActive: section == AppSection.p2p,
              onTap: () => onNavigate(AppSection.p2p),
              isTV: isTV,
            ),
            _CapsuleDivider(),
            _CapsuleButton(
              icon: Icons.settings_outlined,
              label: 'Settings',
              isActive: section == AppSection.settings,
              onTap: () => onNavigate(AppSection.settings),
              isTV: isTV,
            ),
            _CapsuleDivider(),
            _CapsuleButton(
              icon: Icons.person_outline,
              label: 'Profile',
              isActive: section == AppSection.profile,
              onTap: () => onNavigate(AppSection.profile),
              isTV: isTV,
            ),
          ],
        ),
      ),
    );
  }
}

class _CapsuleButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;
  final bool isTV;

  const _CapsuleButton({
    required this.icon, required this.label,
    required this.isActive, required this.onTap,
    this.isTV = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isTV) {
      return TvFocusable(
        onSelect: onTap,
        builder: (context, focused) => Container(
          color: focused || isActive ? Colors.white.withValues(alpha: 0.1) : Colors.transparent,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18,
                  color: focused || isActive ? ZColors.primary : ZColors.mutedForeground),
              const SizedBox(width: 6),
              Text(label, style: ZText.body(13, weight: FontWeight.w600,
                  color: focused || isActive ? ZColors.primary : ZColors.mutedForeground)),
            ],
          ),
        ),
      );
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        color: isActive ? Colors.white.withValues(alpha: 0.1) : Colors.transparent,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16,
                color: isActive ? ZColors.primary : ZColors.mutedForeground),
            const SizedBox(width: 6),
            Text(label, style: ZText.body(12, weight: FontWeight.w600,
                color: isActive ? ZColors.primary : ZColors.mutedForeground)),
          ],
        ),
      ),
    );
  }
}

class _CapsuleDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 20, color: ZColors.border.withValues(alpha: 0.4));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

class _VerticalDivider extends StatelessWidget {
  const _VerticalDivider();

  @override
  Widget build(BuildContext context) {
    return Container(width: 1, color: ZColors.border.withValues(alpha: 0.2));
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
