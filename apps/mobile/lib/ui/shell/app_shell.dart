import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/device_type.dart';
import '../../p2p/client/p2p_client_store.dart';
import '../../p2p/server/p2p_server_store.dart';
import '../../stores/content_store.dart';
import '../p2p/p2p_screen.dart';
import '../profile/profile_screen.dart';
import '../content/content_screen.dart';

enum AppSection { content, favorites, p2p, profile, settings }

/// Root app shell — picks Phone / Tablet / TV layout based on DeviceType.
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
      case AppSection.content:
        return const ContentScreen();
      case AppSection.favorites:
        return const _Placeholder(label: 'Favorites');
      case AppSection.p2p:
        return const P2PScreen();
      case AppSection.profile:
        return const ProfileScreen();
      case AppSection.settings:
        return const _Placeholder(label: 'Settings');
    }
  }

  @override
  Widget build(BuildContext context) {
    final contentStore = context.watch<ContentStore>();
    final isReady = contentStore.isReady;

    // Jump to content browser only after a user-triggered load completes
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
            backgroundColor: const Color(0xFF1E293B),
            valueColor: const AlwaysStoppedAnimation(Color(0xFFEF4444)),
            minHeight: 3,
          )
        : const SizedBox.shrink();

    switch (DeviceTypeDetector.current) {
      case DeviceType.phone:
        return _PhoneShell(
          section: _section,
          onNavigate: _navigate,
          isReady: isReady,
          loadingBanner: loadingBanner,
          content: _buildContent(),
        );
      case DeviceType.tablet:
        return _TabletShell(
          section: _section,
          onNavigate: _navigate,
          isReady: isReady,
          loadingBanner: loadingBanner,
          content: _buildContent(),
        );
      case DeviceType.tv:
        return _TVShell(
          section: _section,
          onNavigate: _navigate,
          isReady: isReady,
          loadingBanner: loadingBanner,
          content: _buildContent(),
        );
    }
  }
}

// ---------------------------------------------------------------------------
// Phone shell — bottom nav, 5 tabs, no client P2P
// ---------------------------------------------------------------------------

class _PhoneShell extends StatelessWidget {
  final AppSection section;
  final void Function(AppSection) onNavigate;
  final bool isReady;
  final Widget content;
  final Widget loadingBanner;

  const _PhoneShell({
    required this.section,
    required this.onNavigate,
    required this.isReady,
    required this.content,
    required this.loadingBanner,
  });

  // Phone has no client — show only server-side P2P screen
  static const _tabs = [
    AppSection.content,
    AppSection.favorites,
    AppSection.p2p,
    AppSection.profile,
    AppSection.settings,
  ];

  int get _index => _tabs.indexOf(section).clamp(0, _tabs.length - 1);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Column(
        children: [
          loadingBanner,
          Expanded(child: content),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) {
          final target = _tabs[i];
          // Content and Favorites require a loaded profile
          if (!isReady &&
              (target == AppSection.content ||
                  target == AppSection.favorites)) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Select a profile first'),
                duration: Duration(seconds: 2),
              ),
            );
            return;
          }
          onNavigate(target);
        },
        backgroundColor: const Color(0xFF1E293B),
        selectedItemColor: const Color(0xFFEF4444),
        unselectedItemColor: const Color(0xFF64748B),
        type: BottomNavigationBarType.fixed,
        items: [
          BottomNavigationBarItem(
            icon: Icon(Icons.tv,
                color: !isReady ? const Color(0xFF334155) : null),
            label: 'Content',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.star,
                color: !isReady ? const Color(0xFF334155) : null),
            label: 'Favorites',
          ),
          const BottomNavigationBarItem(
              icon: Icon(Icons.wifi), label: 'P2P'),
          const BottomNavigationBarItem(
              icon: Icon(Icons.person), label: 'Profile'),
          const BottomNavigationBarItem(
              icon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tablet shell — top header (desktop style), client + server P2P
// ---------------------------------------------------------------------------

class _TabletShell extends StatelessWidget {
  final AppSection section;
  final void Function(AppSection) onNavigate;
  final bool isReady;
  final Widget content;
  final Widget loadingBanner;

  const _TabletShell({
    required this.section,
    required this.onNavigate,
    required this.isReady,
    required this.content,
    required this.loadingBanner,
  });

  @override
  Widget build(BuildContext context) {
    if (!isReady) {
      return Scaffold(
        backgroundColor: const Color(0xFF0F172A),
        body: Column(
          children: [
            loadingBanner,
            Expanded(
              child: Row(
                children: [
                  Expanded(child: content),
                  const VerticalDivider(color: Color(0xFF334155), width: 1),
                  const Expanded(child: P2PScreen()),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Column(
        children: [
          _TopHeader(section: section, onNavigate: onNavigate, showP2PBadge: true),
          loadingBanner,
          Expanded(child: content),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// TV shell — top header (Tizen style), client + server P2P, D-pad focus
// ---------------------------------------------------------------------------

class _TVShell extends StatelessWidget {
  final AppSection section;
  final void Function(AppSection) onNavigate;
  final bool isReady;
  final Widget content;
  final Widget loadingBanner;

  const _TVShell({
    required this.section,
    required this.onNavigate,
    required this.isReady,
    required this.content,
    required this.loadingBanner,
  });

  @override
  Widget build(BuildContext context) {
    if (!isReady) {
      return Scaffold(
        backgroundColor: const Color(0xFF0F172A),
        body: Column(
          children: [
            loadingBanner,
            Expanded(
              child: Row(
                children: [
                  Expanded(child: content),
                  const VerticalDivider(color: Color(0xFF334155), width: 1),
                  const Expanded(child: P2PScreen()),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Column(
        children: [
          _TopHeader(section: section, onNavigate: onNavigate, showP2PBadge: true, isTV: true),
          loadingBanner,
          Expanded(child: content),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Top header — shared by tablet and TV
// ---------------------------------------------------------------------------

class _TopHeader extends StatelessWidget {
  final AppSection section;
  final void Function(AppSection) onNavigate;
  final bool showP2PBadge;
  final bool isTV;

  const _TopHeader({
    required this.section,
    required this.onNavigate,
    this.showP2PBadge = false,
    this.isTV = false,
  });

  static const _sections = [
    (AppSection.content, 'Content'),
    (AppSection.favorites, 'Favorites'),
    (AppSection.p2p, 'P2P'),
    (AppSection.profile, 'Profile'),
    (AppSection.settings, 'Settings'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      height: isTV ? 64 : 56,
      color: const Color(0xFF1E293B),
      padding: EdgeInsets.symmetric(horizontal: isTV ? 32 : 16),
      child: Row(
        children: [
          Text(
            'Zenith TV',
            style: TextStyle(
              color: const Color(0xFFEF4444),
              fontSize: isTV ? 22 : 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(width: isTV ? 40 : 24),
          ..._sections.map((s) => _Tab(
                label: s.$2,
                isActive: section == s.$1,
                isTV: isTV,
                onTap: () => onNavigate(s.$1),
              )),
          const Spacer(),
          if (showP2PBadge) const _P2PBadge(),
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  final String label;
  final bool isActive;
  final bool isTV;
  final VoidCallback onTap;

  const _Tab({
    required this.label,
    required this.isActive,
    required this.onTap,
    this.isTV = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 4),
        padding: EdgeInsets.symmetric(
          horizontal: isTV ? 20 : 14,
          vertical: isTV ? 8 : 6,
        ),
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFFEF4444) : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isActive ? Colors.white : const Color(0xFF94A3B8),
            fontSize: isTV ? 16 : 14,
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// P2P connection badge — shown in header for tablet/TV
// ---------------------------------------------------------------------------

class _P2PBadge extends StatelessWidget {
  const _P2PBadge();

  @override
  Widget build(BuildContext context) {
    return Consumer<P2PClientStore>(
      builder: (context, clientStore, _) {
        return Consumer<P2PServerStore>(
          builder: (context, serverStore, _) {
            final clientConnected = clientStore.isConnected;
            final serverConnections = serverStore.connectionCount;

            if (clientConnected) {
              return _badge(
                Colors.green,
                clientStore.currentServer?.deviceName ?? 'Connected',
              );
            }

            if (serverConnections > 0) {
              return _badge(
                Colors.blue,
                '$serverConnections device${serverConnections > 1 ? 's' : ''} connected',
              );
            }

            return _badge(Colors.grey.shade700, 'P2P off');
          },
        );
      },
    );
  }

  Widget _badge(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 8),
        Text(label,
            style: TextStyle(color: color, fontSize: 13)),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Placeholder
// ---------------------------------------------------------------------------

class _Placeholder extends StatelessWidget {
  final String label;
  const _Placeholder({required this.label});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        '$label — coming soon',
        style: const TextStyle(color: Colors.white54, fontSize: 18),
      ),
    );
  }
}
