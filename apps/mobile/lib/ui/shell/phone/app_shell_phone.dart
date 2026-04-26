import 'package:flutter/material.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/content_store.dart';
import '../../../stores/media_player_store.dart';
import '../../p2p/p2p_screen.dart';
import '../../profile/profile_screen.dart';
import '../../content/content_screen.dart';
import '../../../components/settings/shared/settings_panel.dart';
import '../app_section.dart';

class AppShellPhone extends StatefulWidget {
  const AppShellPhone({super.key});

  @override
  State<AppShellPhone> createState() => _AppShellPhoneState();
}

class _AppShellPhoneState extends State<AppShellPhone> {
  AppSection _section = AppSection.profile;
  VideoController? _videoController;

  static const _tabs = [
    AppSection.content, AppSection.favorites,
    AppSection.p2p, AppSection.profile, AppSection.settings,
  ];

  int get _index => _tabs.indexOf(_section).clamp(0, _tabs.length - 1);

  VideoController _getOrCreateController(MediaPlayerStore store) {
    return _videoController ??= VideoController(
      store.player,
      configuration: const VideoControllerConfiguration(
        enableHardwareAcceleration: true,
      ),
    );
  }

  void _navigate(AppSection section) => setState(() => _section = section);

  Widget _buildSection(ContentStore contentStore, VideoController controller) {
    switch (_section) {
      case AppSection.content:
        return ContentScreen(controller: controller);
      case AppSection.favorites:
        return const _Placeholder(label: 'Favorites');
      case AppSection.p2p:
        return const P2PScreen();
      case AppSection.profile:
        return const ProfileScreen();
      case AppSection.settings:
        return Scaffold(
          backgroundColor: ZColors.background,
          appBar: AppBar(title: const Text('Settings')),
          body: const SingleChildScrollView(
            padding: EdgeInsets.all(16),
            child: SettingsPanel(),
          ),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final contentStore = context.watch<ContentStore>();
    final mediaStore   = context.read<MediaPlayerStore>();
    final controller   = _getOrCreateController(mediaStore);

    if (contentStore.justLoaded) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          contentStore.justLoaded = false;
          setState(() => _section = AppSection.content);
        }
      });
    }

    return Scaffold(
      backgroundColor: ZColors.background,
      body: _buildSection(contentStore, controller),
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
            if (!contentStore.isReady &&
                (target == AppSection.content || target == AppSection.favorites)) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Select a profile first'),
                  duration: Duration(seconds: 2),
                ),
              );
              return;
            }
            _navigate(target);
          },
          selectedItemColor: ZColors.primary,
          unselectedItemColor: ZColors.mutedForeground,
          type: BottomNavigationBarType.fixed,
          selectedLabelStyle: ZText.body(11, weight: FontWeight.w700),
          unselectedLabelStyle: ZText.body(11),
          items: [
            BottomNavigationBarItem(
              icon: Icon(Icons.tv,
                  color: !contentStore.isReady ? ZColors.border : null),
              label: 'Content',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.star,
                  color: !contentStore.isReady ? ZColors.border : null),
              label: 'Favorites',
            ),
            const BottomNavigationBarItem(
                icon: Icon(Icons.cell_tower_rounded), label: 'P2P'),
            const BottomNavigationBarItem(
                icon: Icon(Icons.person_outline), label: 'Profile'),
            const BottomNavigationBarItem(
                icon: Icon(Icons.settings_outlined), label: 'Settings'),
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
