import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/settings_store.dart';
import 'setting_row.dart';
import 'settings_section.dart';

const _colorPalette = [
  (label: 'White',       value: 0xffffffff),
  (label: 'Yellow',      value: 0xffffff00),
  (label: 'Black',       value: 0xff000000),
  (label: 'Red',         value: 0xffff3b30),
  (label: 'Green',       value: 0xff34c759),
  (label: 'Cyan',        value: 0xff5ac8fa),
  (label: 'Blue',        value: 0xff007aff),
  (label: 'Transparent', value: 0x00000000),
];

class SubtitleSettings extends StatelessWidget {
  const SubtitleSettings({super.key});

  @override
  Widget build(BuildContext context) {
    final store = context.watch<SettingsStore>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SettingsSection(
          title: 'Subtitle Appearance',
          icon: Icons.subtitles_outlined,
          children: [
            // Font size
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text('Font Size',
                            style: ZText.body(14, weight: FontWeight.w500)),
                      ),
                      Text('${store.subtitleFontSize.round()}px',
                          style: ZText.body(13, color: ZColors.mutedForeground)),
                    ],
                  ),
                  Slider(
                    value: store.subtitleFontSize,
                    min: 12, max: 48, divisions: 36,
                    onChanged: store.setSubtitleFontSize,
                    activeColor: ZColors.primary,
                    inactiveColor: ZColors.border,
                  ),
                ],
              ),
            ),

            // Bold
            SettingRow(
              label: 'Bold',
              control: Switch(
                value: store.subtitleBold,
                onChanged: store.setSubtitleBold,
              ),
            ),

            // Text align
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  Expanded(
                    child: Text('Text Align',
                        style: ZText.body(14, weight: FontWeight.w500)),
                  ),
                  const SizedBox(width: 16),
                  _AlignSelector(
                    value: store.subtitleTextAlign,
                    onChanged: store.setSubtitleTextAlign,
                  ),
                ],
              ),
            ),

            // Text color
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  Expanded(
                    child: Text('Text Color',
                        style: ZText.body(14, weight: FontWeight.w500)),
                  ),
                  const SizedBox(width: 16),
                  _ColorGrid(
                    selected: store.subtitleTextColor,
                    onSelected: store.setSubtitleTextColor,
                    showTransparent: false,
                  ),
                ],
              ),
            ),

            // Background color
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  Expanded(
                    child: Text('Background Color',
                        style: ZText.body(14, weight: FontWeight.w500)),
                  ),
                  const SizedBox(width: 16),
                  _ColorGrid(
                    selected: store.subtitleBgColor,
                    onSelected: store.setSubtitleBgColor,
                    showTransparent: true,
                  ),
                ],
              ),
            ),
          ],
        ),

        // Preview — outside section, full width
        _SubtitlePreview(store: store),
      ],
    );
  }
}

// ── Align selector ────────────────────────────────────────────────────────────

class _AlignSelector extends StatelessWidget {
  final String value;
  final void Function(String) onChanged;

  const _AlignSelector({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    const options = [
      (icon: Icons.format_align_left,   value: 'left'),
      (icon: Icons.format_align_center, value: 'center'),
      (icon: Icons.format_align_right,  value: 'right'),
    ];

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: options.map((opt) {
        final selected = value == opt.value;
        return GestureDetector(
          onTap: () => onChanged(opt.value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            width: 36, height: 32,
            margin: const EdgeInsets.only(left: 4),
            decoration: BoxDecoration(
              color: selected ? ZColors.accent : ZColors.muted,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: selected
                    ? ZColors.primary.withValues(alpha: 0.4)
                    : ZColors.border.withValues(alpha: 0.2),
              ),
            ),
            child: Icon(opt.icon, size: 16,
                color: selected ? ZColors.primary : ZColors.mutedForeground),
          ),
        );
      }).toList(),
    );
  }
}

// ── Color grid ────────────────────────────────────────────────────────────────

class _ColorGrid extends StatelessWidget {
  final int selected;
  final void Function(int) onSelected;
  final bool showTransparent;

  const _ColorGrid({
    required this.selected,
    required this.onSelected,
    required this.showTransparent,
  });

  @override
  Widget build(BuildContext context) {
    final colors = showTransparent
        ? _colorPalette
        : _colorPalette.where((c) => c.value != 0x00000000).toList();

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: colors.map((c) {
        final isSelected = selected == c.value;
        final isTransparent = c.value == 0x00000000;
        return GestureDetector(
          onTap: () => onSelected(c.value),
          child: Container(
            width: 28, height: 28,
            margin: const EdgeInsets.only(left: 6),
            decoration: BoxDecoration(
              color: isTransparent ? Colors.transparent : Color(c.value),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: isSelected
                    ? ZColors.primary
                    : ZColors.border.withValues(alpha: 0.3),
                width: isSelected ? 2 : 1,
              ),
            ),
            child: isTransparent
                ? Icon(Icons.block, size: 16, color: ZColors.mutedForeground)
                : isSelected
                    ? Icon(Icons.check, size: 16, color: _contrastColor(c.value))
                    : null,
          ),
        );
      }).toList(),
    );
  }

  Color _contrastColor(int v) {
    final r = (v >> 16) & 0xff;
    final g = (v >> 8) & 0xff;
    final b = v & 0xff;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5
        ? Colors.black
        : Colors.white;
  }
}

// ── Preview ───────────────────────────────────────────────────────────────────

class _SubtitlePreview extends StatelessWidget {
  final SettingsStore store;
  const _SubtitlePreview({required this.store});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
      decoration: BoxDecoration(
        color: ZColors.background,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.2)),
      ),
      child: Text(
        'The quick brown fox jumps',
        textAlign: switch (store.subtitleTextAlign) {
          'left'  => TextAlign.left,
          'right' => TextAlign.right,
          _       => TextAlign.center,
        },
        style: TextStyle(
          fontSize: store.subtitleFontSize,
          fontWeight: store.subtitleBold ? FontWeight.bold : FontWeight.normal,
          color: Color(store.subtitleTextColor),
          backgroundColor: Color(store.subtitleBgColor),
          height: 1.4,
        ),
      ),
    );
  }
}
