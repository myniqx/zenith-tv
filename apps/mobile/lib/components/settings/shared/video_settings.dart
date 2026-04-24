import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/settings_store.dart';
import 'setting_row.dart';
import 'settings_section.dart';

const _availableLanguages = [
  'English', 'Turkish', 'German', 'French', 'Spanish',
  'Italian', 'Russian', 'Japanese', 'Korean', 'Chinese',
];

class VideoSettings extends StatelessWidget {
  const VideoSettings({super.key});

  @override
  Widget build(BuildContext context) {
    final store = context.watch<SettingsStore>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SettingsSection(
          title: 'Volume',
          icon: Icons.volume_up_outlined,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Default Volume: ${(store.defaultVolume * 100).round()}%',
                    style: ZText.body(13),
                  ),
                  const SizedBox(height: 8),
                  Slider(
                    value: store.defaultVolume,
                    onChanged: store.setDefaultVolume,
                    min: 0, max: 1, divisions: 100,
                    activeColor: ZColors.primary,
                    inactiveColor: ZColors.border,
                  ),
                ],
              ),
            ),
          ],
        ),

        SettingsSection(
          title: 'Playback',
          icon: Icons.play_circle_outline,
          children: [
            SettingRow(
              label: 'Auto-Resume Playback',
              description: 'Continue from where you left off',
              control: Switch(
                value: store.autoResume,
                onChanged: store.setAutoResume,
              ),
            ),
            SettingRow(
              label: 'Auto-Play Next Episode',
              description: 'Automatically play next episode when current ends',
              control: Switch(
                value: store.autoPlayNext,
                onChanged: store.setAutoPlayNext,
              ),
            ),
          ],
        ),

        _LanguagePrioritySection(
          title: 'Audio Language Priority',
          icon: Icons.audio_file_outlined,
          selected: store.preferredAudioLanguages,
          onAdd: store.addPreferredAudioLanguage,
          onRemove: store.removePreferredAudioLanguage,
          onReorder: store.reorderPreferredAudioLanguages,
        ),

        _LanguagePrioritySection(
          title: 'Subtitle Language Priority',
          icon: Icons.subtitles_outlined,
          selected: store.preferredSubtitleLanguages,
          onAdd: store.addPreferredSubtitleLanguage,
          onRemove: store.removePreferredSubtitleLanguage,
          onReorder: store.reorderPreferredSubtitleLanguages,
        ),
      ],
    );
  }
}

class _LanguagePrioritySection extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<String> selected;
  final void Function(String) onAdd;
  final void Function(String) onRemove;
  final void Function(int, int) onReorder;

  const _LanguagePrioritySection({
    required this.title,
    required this.icon,
    required this.selected,
    required this.onAdd,
    required this.onRemove,
    required this.onReorder,
  });

  List<String> get _available =>
      _availableLanguages.where((l) => !selected.contains(l)).toList();

  @override
  Widget build(BuildContext context) {
    return SettingsSection(
      title: title,
      icon: icon,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Priority list (reorderable)
              if (selected.isNotEmpty)
                ReorderableListView(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  onReorder: onReorder,
                  proxyDecorator: (child, index, animation) => Material(
                    color: Colors.transparent,
                    child: child,
                  ),
                  children: [
                    for (int i = 0; i < selected.length; i++)
                      _LanguageChip(
                        key: ValueKey(selected[i]),
                        label: selected[i],
                        priority: i + 1,
                        onRemove: () => onRemove(selected[i]),
                      ),
                  ],
                ),

              // Add button
              if (_available.isNotEmpty)
                Padding(
                  padding: EdgeInsets.only(top: selected.isNotEmpty ? 8 : 0),
                  child: _AddLanguageButton(
                    available: _available,
                    onAdd: onAdd,
                  ),
                ),

              if (selected.isEmpty && _available.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: SizedBox(
                    width: double.infinity,
                    child: Text('No languages available',
                        style: ZText.body(12, color: ZColors.mutedForeground)),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _LanguageChip extends StatelessWidget {
  final String label;
  final int priority;
  final VoidCallback onRemove;

  const _LanguageChip({
    super.key,
    required this.label,
    required this.priority,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: ZColors.muted,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          // Priority badge
          Container(
            width: 20, height: 20,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: priority == 1
                  ? ZColors.primary.withValues(alpha: 0.2)
                  : ZColors.secondary,
              shape: BoxShape.circle,
            ),
            child: Text('$priority',
                style: ZText.body(10,
                    weight: FontWeight.w700,
                    color: priority == 1
                        ? ZColors.primary
                        : ZColors.mutedForeground)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(label, style: ZText.body(13)),
          ),
          // Remove
          GestureDetector(
            onTap: onRemove,
            child: const Icon(Icons.close,
                size: 16, color: ZColors.mutedForeground),
          ),
          const SizedBox(width: 12),
          // Drag handle
          const Icon(Icons.drag_indicator,
              size: 18, color: ZColors.mutedForeground),
        ],
      ),
    );
  }
}

class _AddLanguageButton extends StatelessWidget {
  final List<String> available;
  final void Function(String) onAdd;

  const _AddLanguageButton({
    required this.available,
    required this.onAdd,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        showModalBottomSheet(
          context: context,
          backgroundColor: ZColors.secondary,
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          ),
          builder: (ctx) => ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.symmetric(vertical: 8),
            children: available
                .map((lang) => ListTile(
                      title: Text(lang, style: ZText.body(14)),
                      onTap: () {
                        onAdd(lang);
                        Navigator.pop(ctx);
                      },
                    ))
                .toList(),
          ),
        );
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: ZColors.border.withValues(alpha: 0.3),
            style: BorderStyle.solid,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.add, size: 14, color: ZColors.mutedForeground),
            const SizedBox(width: 6),
            Text('Add language',
                style: ZText.body(13, color: ZColors.mutedForeground)),
          ],
        ),
      ),
    );
  }
}
