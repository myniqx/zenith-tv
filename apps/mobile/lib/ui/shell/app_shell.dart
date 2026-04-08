import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/device_type.dart';
import '../../p2p/client/p2p_client_store.dart';
import '../p2p/p2p_screen.dart';

enum _Section { p2p, settings }

/// Root app shell — selects TV or touch layout based on DeviceType.
/// Mirrors: apps/tizen/src/App.tsx + apps/desktop/src/App.tsx
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  _Section _activeSection = _Section.p2p;

  void _navigate(_Section section) {
    setState(() => _activeSection = section);
  }

  Widget _buildContent() {
    switch (_activeSection) {
      case _Section.p2p:
        return const P2PScreen();
      case _Section.settings:
        return const _SettingsPlaceholder();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (DeviceTypeDetector.isTV) {
      return _TVShell(
        activeSection: _activeSection,
        onNavigate: _navigate,
        content: _buildContent(),
      );
    }

    return _TouchShell(
      activeSection: _activeSection,
      onNavigate: _navigate,
      content: _buildContent(),
    );
  }
}

// ---------------------------------------------------------------------------
// TV shell — horizontal top menu, full-screen content area
// Mirrors: Tizen header layout
// ---------------------------------------------------------------------------

class _TVShell extends StatelessWidget {
  final _Section activeSection;
  final void Function(_Section) onNavigate;
  final Widget content;

  const _TVShell({
    required this.activeSection,
    required this.onNavigate,
    required this.content,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Column(
        children: [
          _TVHeader(activeSection: activeSection, onNavigate: onNavigate),
          Expanded(child: content),
        ],
      ),
    );
  }
}

class _TVHeader extends StatelessWidget {
  final _Section activeSection;
  final void Function(_Section) onNavigate;

  const _TVHeader(
      {required this.activeSection, required this.onNavigate});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 60,
      color: const Color(0xFF1E293B),
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Row(
        children: [
          const Text(
            'Zenith TV',
            style: TextStyle(
              color: Color(0xFFEF4444),
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(width: 48),
          _HeaderTab(
            label: 'P2P',
            isActive: activeSection == _Section.p2p,
            onTap: () => onNavigate(_Section.p2p),
          ),
          _HeaderTab(
            label: 'Settings',
            isActive: activeSection == _Section.settings,
            onTap: () => onNavigate(_Section.settings),
          ),
          const Spacer(),
          _ConnectionBadge(),
        ],
      ),
    );
  }
}

class _HeaderTab extends StatelessWidget {
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _HeaderTab(
      {required this.label, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFFEF4444) : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isActive ? Colors.white : const Color(0xFF94A3B8),
            fontSize: 16,
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Touch shell — bottom navigation bar
// ---------------------------------------------------------------------------

class _TouchShell extends StatelessWidget {
  final _Section activeSection;
  final void Function(_Section) onNavigate;
  final Widget content;

  const _TouchShell({
    required this.activeSection,
    required this.onNavigate,
    required this.content,
  });

  int get _currentIndex =>
      _Section.values.indexOf(activeSection);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: content,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => onNavigate(_Section.values[i]),
        backgroundColor: const Color(0xFF1E293B),
        selectedItemColor: const Color(0xFFEF4444),
        unselectedItemColor: const Color(0xFF64748B),
        items: const [
          BottomNavigationBarItem(
              icon: Icon(Icons.wifi), label: 'P2P'),
          BottomNavigationBarItem(
              icon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Connection badge (header indicator)
// ---------------------------------------------------------------------------

class _ConnectionBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<P2PClientStore>(
      builder: (context, store, _) {
        final connected = store.isConnected;
        return Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: connected ? Colors.green : Colors.red,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              connected
                  ? store.currentServer?.deviceName ?? 'Connected'
                  : 'Not connected',
              style: TextStyle(
                color: connected ? Colors.green.shade300 : Colors.grey,
                fontSize: 14,
              ),
            ),
          ],
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Placeholder screens (filled in later steps)
// ---------------------------------------------------------------------------

class _SettingsPlaceholder extends StatelessWidget {
  const _SettingsPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Text('Settings — coming soon',
          style: TextStyle(color: Colors.white54, fontSize: 18)),
    );
  }
}
