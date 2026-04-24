import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';
import '../shared/server_section.dart';
import '../shared/client_section.dart';

enum _P2PMode { off, server, client }

class P2PPanelTablet extends StatefulWidget {
  const P2PPanelTablet({super.key});

  @override
  State<P2PPanelTablet> createState() => _P2PPanelTabletState();
}

class _P2PPanelTabletState extends State<P2PPanelTablet> {
  _P2PMode _mode = _P2PMode.off;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left: mode selector
        SizedBox(
          width: 160,
          child: _ModeSelector(
            selected: _mode,
            onSelect: (m) => setState(() => _mode = m),
          ),
        ),
        const SizedBox(width: 16),
        // Right: content
        Expanded(
          child: SingleChildScrollView(
            child: _buildContent(),
          ),
        ),
      ],
    );
  }

  Widget _buildContent() {
    return switch (_mode) {
      _P2PMode.off    => _OffState(),
      _P2PMode.server => const ServerSection(),
      _P2PMode.client => const ClientSection(),
    };
  }
}

class _ModeSelector extends StatelessWidget {
  final _P2PMode selected;
  final void Function(_P2PMode) onSelect;

  const _ModeSelector({required this.selected, required this.onSelect});

  static const _modes = [
    (_P2PMode.off,    Icons.power_settings_new_outlined, 'Off'),
    (_P2PMode.server, Icons.wifi_tethering_outlined,     'Server'),
    (_P2PMode.client, Icons.monitor_outlined,            'Client'),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8, left: 2),
          child: Text('Mode', style: ZText.labelUpper),
        ),
        ...(_modes.map((item) => _ModeButton(
          icon: item.$2,
          label: item.$3,
          isSelected: selected == item.$1,
          onTap: () => onSelect(item.$1),
        ))),
      ],
    );
  }
}

class _ModeButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _ModeButton({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? ZColors.accent : ZColors.secondary,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected
                ? ZColors.primary.withValues(alpha: 0.4)
                : ZColors.border.withValues(alpha: 0.15),
          ),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18,
                color: isSelected ? ZColors.primary : ZColors.mutedForeground),
            const SizedBox(width: 10),
            Text(label,
                style: ZText.body(14, weight: FontWeight.w600,
                    color: isSelected ? ZColors.primary : ZColors.foreground)),
          ],
        ),
      ),
    );
  }
}

class _OffState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Column(
          children: [
            const Icon(Icons.power_settings_new_outlined,
                size: 48, color: ZColors.mutedForeground),
            const SizedBox(height: 16),
            Text('Remote control is disabled',
                style: ZText.body(15, color: ZColors.mutedForeground)),
            const SizedBox(height: 8),
            Text(
              'Select Server to control other devices,\nor Client to be controlled.',
              textAlign: TextAlign.center,
              style: ZText.body(13, color: ZColors.mutedForeground),
            ),
          ],
        ),
      ),
    );
  }
}
