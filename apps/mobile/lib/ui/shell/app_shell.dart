import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/device_type.dart';
import '../../p2p/client/p2p_client_store.dart';
import '../../p2p/server/p2p_server_store.dart';
import '../../stores/content_store.dart';
import '../p2p/p2p_screen.dart';

enum AppSection { content, favorites, p2p, profile, settings }

/// Root app shell — picks Phone / Tablet / TV layout based on DeviceType.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  AppSection _section = AppSection.profile; // profile is always the first screen

  bool get _isReady => context.watch<ContentStore>().isReady;

  void _navigate(AppSection section) => setState(() => _section = section);

  Widget _buildContent() {
    switch (_section) {
      case AppSection.content:
        return const _Placeholder(label: 'Content Browser');
      case AppSection.favorites:
        return const _Placeholder(label: 'Favorites');
      case AppSection.p2p:
        return const P2PScreen();
      case AppSection.profile:
        return const _Placeholder(label: 'Profile');
      case AppSection.settings:
        return const _Placeholder(label: 'Settings');
    }
  }

  @override
  Widget build(BuildContext context) {
    switch (DeviceTypeDetector.current) {
      case DeviceType.phone:
        return _PhoneShell(
          section: _section,
          onNavigate: _navigate,
          isReady: _isReady,
          content: _buildContent(),
        );
      case DeviceType.tablet:
        return _TabletShell(
          section: _section,
          onNavigate: _navigate,
          isReady: _isReady,
          content: _buildContent(),
        );
      case DeviceType.tv:
        return _TVShell(
          section: _section,
          onNavigate: _navigate,
          isReady: _isReady,
          content: _buildContent(),
        );
    }
  }
}

// ---------------------------------------------------------------------------
// Phone shell — bottom nav, 5 tabs, server (controller) mode only
// ---------------------------------------------------------------------------

class _PhoneShell extends StatelessWidget {
  final AppSection section;
  final void Function(AppSection) onNavigate;
  final bool isReady;
  final Widget content;

  const _PhoneShell({
    required this.section,
    required this.onNavigate,
    required this.isReady,
    required this.content,
  });

  // Phone is server-only — acts as remote control, no local video playback
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
    // Not ready: show profile setup full screen, no nav bar
    if (!isReady) {
      return Scaffold(
        backgroundColor: const Color(0xFF0F172A),
        body: content,
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: content,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => onNavigate(_tabs[i]),
        backgroundColor: const Color(0xFF1E293B),
        selectedItemColor: const Color(0xFFEF4444),
        unselectedItemColor: const Color(0xFF64748B),
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.tv), label: 'Content'),
          BottomNavigationBarItem(icon: Icon(Icons.star), label: 'Favorites'),
          BottomNavigationBarItem(icon: Icon(Icons.wifi), label: 'P2P'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
          BottomNavigationBarItem(icon: Icon(Icons.settings), label: 'Settings'),
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

  const _TabletShell({
    required this.section,
    required this.onNavigate,
    required this.isReady,
    required this.content,
  });

  @override
  Widget build(BuildContext context) {
    // Not ready: split screen — profile left, P2P right
    if (!isReady) {
      return Scaffold(
        backgroundColor: const Color(0xFF0F172A),
        body: Row(
          children: [
            Expanded(child: content), // profile section
            const VerticalDivider(color: Color(0xFF334155), width: 1),
            const Expanded(child: P2PScreen()),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Column(
        children: [
          _TopHeader(
            section: section,
            onNavigate: onNavigate,
            showP2PBadge: true,
          ),
          Expanded(child: content),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// TV shell — top header (Tizen style), client (player) mode only, D-pad focus
// ---------------------------------------------------------------------------

class _TVShell extends StatelessWidget {
  final AppSection section;
  final void Function(AppSection) onNavigate;
  final bool isReady;
  final Widget content;

  const _TVShell({
    required this.section,
    required this.onNavigate,
    required this.isReady,
    required this.content,
  });

  @override
  Widget build(BuildContext context) {
    // Not ready: split screen — profile left, P2P right
    if (!isReady) {
      return Scaffold(
        backgroundColor: const Color(0xFF0F172A),
        body: Row(
          children: [
            Expanded(child: content), // profile section
            const VerticalDivider(color: Color(0xFF334155), width: 1),
            const Expanded(child: P2PScreen()),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Column(
        children: [
          _TopHeader(
            section: section,
            onNavigate: onNavigate,
            showP2PBadge: true,
            isTV: true,
          ),
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
