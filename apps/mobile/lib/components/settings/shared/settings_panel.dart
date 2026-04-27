import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';
import 'general_settings.dart';
import 'keyboard_shortcuts.dart';
import 'subtitle_settings.dart';
import 'video_settings.dart';

class SettingsPanel extends StatefulWidget {
  const SettingsPanel({super.key});

  @override
  State<SettingsPanel> createState() => _SettingsPanelState();
}

class _SettingsPanelState extends State<SettingsPanel> {
  int _tabIndex = 0;

  bool get _showShortcuts =>
      !kIsWeb && (Platform.isLinux || Platform.isWindows || Platform.isMacOS);

  @override
  Widget build(BuildContext context) {
    final tabs = [
      (Icons.settings_outlined,    'General'),
      (Icons.play_circle_outline,  'Video'),
      (Icons.subtitles_outlined,   'Subtitles'),
      if (_showShortcuts)
        (Icons.keyboard_outlined,  'Shortcuts'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Tab bar
        Container(
          decoration: BoxDecoration(
            color: ZColors.muted,
            borderRadius: BorderRadius.circular(10),
          ),
          padding: const EdgeInsets.all(4),
          child: Row(
            children: [
              for (int i = 0; i < tabs.length; i++)
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _tabIndex = i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: _tabIndex == i
                            ? ZColors.secondary
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(7),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(tabs[i].$1, size: 14,
                              color: _tabIndex == i
                                  ? ZColors.primary
                                  : ZColors.mutedForeground),
                          const SizedBox(width: 6),
                          Text(tabs[i].$2,
                              style: ZText.body(13,
                                  weight: _tabIndex == i
                                      ? FontWeight.w600
                                      : FontWeight.w400,
                                  color: _tabIndex == i
                                      ? ZColors.primary
                                      : ZColors.mutedForeground)),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Tab content — caller is responsible for scroll/expand context
        switch (_tabIndex) {
          0 => const GeneralSettings(),
          1 => const VideoSettings(),
          2 => const SubtitleSettings(),
          _ => const KeyboardShortcutsSettings(),
        },
      ],
    );
  }
}
