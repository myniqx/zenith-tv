import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../p2p/client/p2p_client_store.dart';
import '../../../p2p/server/p2p_server_store.dart';
import '../../../stores/settings_store.dart';
import '../shared/server_section.dart';
import '../shared/client_section.dart';

class P2PPanelTablet extends StatelessWidget {
  const P2PPanelTablet({super.key});

  @override
  Widget build(BuildContext context) {
    final clientStore   = context.watch<P2PClientStore>();
    final serverStore   = context.watch<P2PServerStore>();
    final settingsStore = context.watch<SettingsStore>();
    final mode          = settingsStore.lastP2PMode;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 160,
          child: _ModeSelector(
            selected: mode,
            clientStore: clientStore,
            serverStore: serverStore,
            settingsStore: settingsStore,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: SingleChildScrollView(
            child: switch (mode) {
              LastP2PMode.off    => const _OffState(),
              LastP2PMode.server => const ServerSection(),
              LastP2PMode.client => const ClientSection(),
            },
          ),
        ),
      ],
    );
  }
}

// ── Mode selector ─────────────────────────────────────────────────────────────

class _ModeSelector extends StatelessWidget {
  final LastP2PMode selected;
  final P2PClientStore clientStore;
  final P2PServerStore serverStore;
  final SettingsStore settingsStore;

  const _ModeSelector({
    required this.selected,
    required this.clientStore,
    required this.serverStore,
    required this.settingsStore,
  });

  static const _modes = [
    (LastP2PMode.off,    Icons.power_settings_new_outlined, 'Off'),
    (LastP2PMode.server, Icons.wifi_tethering_outlined,     'Server'),
    (LastP2PMode.client, Icons.monitor_outlined,            'Client'),
  ];

  Future<void> _select(BuildContext context, LastP2PMode target) async {
    if (target == selected) return;

    final clientActive = clientStore.isConnected;
    final serverActive = serverStore.isRunning;

    // --- Off ---
    if (target == LastP2PMode.off) {
      if (clientActive) {
        bool ok = true;
        try { await clientStore.disconnect(); } catch (_) { ok = false; }
        if (!ok) {
          if (context.mounted) _showError(context, 'Disconnect failed.');
          return;
        }
      }
      if (serverActive) await serverStore.stopServer();
      settingsStore.setLastP2PMode(LastP2PMode.off);
      return;
    }

    // --- Client ---
    if (target == LastP2PMode.client) {
      if (serverActive) {
        final confirm = await _confirm(context, 'Server is running. Stop it and switch to Client?');
        if (!confirm) return;
        await serverStore.stopServer();
      }
      settingsStore.setLastP2PMode(LastP2PMode.client);
      return;
    }

    // --- Server ---
    if (target == LastP2PMode.server) {
      if (clientActive) {
        final confirm = await _confirm(context, 'Client is connected. Disconnect and switch to Server?');
        if (!confirm) return;
        try {
          await clientStore.disconnect();
        } catch (_) {
          if (context.mounted) _showError(context, 'Failed to disconnect client.');
          return;
        }
      }
      settingsStore.setLastP2PMode(LastP2PMode.server);
    }
  }

  Future<bool> _confirm(BuildContext context, String message) async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: ZColors.secondary,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            content: Text(message, style: ZText.body(14)),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text('Cancel',
                    style: ZText.body(13, color: ZColors.mutedForeground)),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: Text('Continue',
                    style: ZText.body(13, color: ZColors.primary)),
              ),
            ],
          ),
        ) ??
        false;
  }

  void _showError(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: ZText.body(13)),
        backgroundColor: ZColors.secondary,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

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
          onTap: () => _select(context, item.$1),
        ))),
      ],
    );
  }
}

// ── Mode button with hover ────────────────────────────────────────────────────

class _ModeButton extends StatefulWidget {
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
  State<_ModeButton> createState() => _ModeButtonState();
}

class _ModeButtonState extends State<_ModeButton> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final highlight = widget.isSelected || _hovered;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: widget.isSelected
                ? ZColors.accent
                : _hovered
                    ? ZColors.accent.withValues(alpha: 0.5)
                    : ZColors.secondary,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: highlight
                  ? ZColors.primary.withValues(alpha: 0.4)
                  : ZColors.border.withValues(alpha: 0.15),
            ),
          ),
          child: Row(
            children: [
              Icon(widget.icon,
                  size: 18,
                  color: highlight ? ZColors.primary : ZColors.mutedForeground),
              const SizedBox(width: 10),
              Text(widget.label,
                  style: ZText.body(14,
                      weight: FontWeight.w600,
                      color: highlight ? ZColors.primary : ZColors.foreground)),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Off state ─────────────────────────────────────────────────────────────────

class _OffState extends StatelessWidget {
  const _OffState();

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
