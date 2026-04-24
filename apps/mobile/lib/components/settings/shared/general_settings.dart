import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/settings_store.dart';
import 'setting_row.dart';
import 'settings_section.dart';

class GeneralSettings extends StatelessWidget {
  const GeneralSettings({super.key});

  @override
  Widget build(BuildContext context) {
    final store = context.watch<SettingsStore>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SettingsSection(
          title: 'Startup',
          icon: Icons.power_settings_new,
          children: [
            SettingRow(
              label: 'Auto Load Last Profile',
              description: 'Automatically load your last used profile on startup',
              control: Switch(
                value: store.autoLoadLastProfile,
                onChanged: store.setAutoLoadLastProfile,
              ),
            ),
            SettingRow(
              label: 'Remember Layout',
              description: 'Restore last category, sort, and grouping settings',
              control: Switch(
                value: store.rememberLayout,
                onChanged: store.setRememberLayout,
              ),
            ),
          ],
        ),

        SettingsSection(
          title: 'Language',
          icon: Icons.language,
          children: [
            SettingRow(
              label: 'App Language',
              control: DropdownButton<String>(
                value: store.language,
                dropdownColor: ZColors.secondary,
                style: ZText.body(14),
                underline: const SizedBox.shrink(),
                items: const [
                  DropdownMenuItem(value: 'en', child: Text('English')),
                  DropdownMenuItem(value: 'tr', child: Text('Türkçe')),
                ],
                onChanged: (v) { if (v != null) store.setLanguage(v); },
              ),
            ),
          ],
        ),

        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: OutlinedButton(
            onPressed: () {
              showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Reset Settings'),
                  content: const Text('Reset all settings to default values?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('Cancel'),
                    ),
                    TextButton(
                      onPressed: () {
                        store.resetSettings();
                        Navigator.pop(ctx);
                      },
                      child: Text('Reset',
                          style: ZText.body(14, color: ZColors.destructiveFg)),
                    ),
                  ],
                ),
              );
            },
            child: const Text('Reset to Defaults'),
          ),
        ),
      ],
    );
  }
}
