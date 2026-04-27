import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../p2p/client/p2p_client.dart';
import '../../../p2p/client/p2p_client_store.dart';
import '../../../p2p/models/p2p_connection.dart';
import '../../../p2p/server/p2p_server_store.dart';
import '../../../stores/universal_player_store.dart';

/// Header capsule button for P2P status and active client selection.
///
/// State matrix:
///   server running + client selected  → client name + dropdown
///   server running + no client        → "Waiting..." (amber dot)
///   server stopped                    → "P2P" (muted)
///   client connected                  → "Connected" (green dot)
///   client connecting / error         → "Connecting..." (amber dot)
class P2PButton extends StatefulWidget {
  /// Called when the button is tapped in off/client mode (opens P2P settings).
  final VoidCallback onOpenSettings;

  const P2PButton({super.key, required this.onOpenSettings});

  @override
  State<P2PButton> createState() => _P2PButtonState();
}

class _P2PButtonState extends State<P2PButton> {
  final _layerLink = LayerLink();
  OverlayEntry? _overlay;
  bool _open = false;

  void _closeDropdown() {
    _overlay?.remove();
    _overlay = null;
    if (mounted) setState(() => _open = false);
  }

  void _openDropdown(BuildContext context, P2PServerStore server) {
    if (_open) {
      _closeDropdown();
      return;
    }

    final overlay = Overlay.of(context);
    _overlay = OverlayEntry(
      builder: (_) => _DropdownOverlay(
        layerLink: _layerLink,
        server: server,
        onClose: _closeDropdown,
        onOpenSettings: () {
          _closeDropdown();
          widget.onOpenSettings();
        },
      ),
    );
    overlay.insert(_overlay!);
    setState(() => _open = true);
  }

  @override
  void dispose() {
    _closeDropdown();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final server = context.watch<P2PServerStore>();
    final client = context.watch<P2PClientStore>();
    final mode   = context.watch<UniversalPlayerStore>().mode;

    return CompositedTransformTarget(
      link: _layerLink,
      child: _ButtonBody(
        server: server,
        client: client,
        mode: mode,
        dropdownOpen: _open,
        onTap: () {
          if (server.isRunning) {
            _openDropdown(context, server);
          } else {
            widget.onOpenSettings();
          }
        },
      ),
    );
  }
}

// ── Button body ───────────────────────────────────────────────────────────────

class _ButtonBody extends StatefulWidget {
  final P2PServerStore server;
  final P2PClientStore client;
  final P2PMode mode;
  final bool dropdownOpen;
  final VoidCallback onTap;

  const _ButtonBody({
    required this.server,
    required this.client,
    required this.mode,
    required this.dropdownOpen,
    required this.onTap,
  });

  @override
  State<_ButtonBody> createState() => _ButtonBodyState();
}

class _ButtonBodyState extends State<_ButtonBody> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final (icon, label, dotColor) = _resolve();
    final highlight = _hovered || widget.dropdownOpen;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hovered = true),
      onExit:  (_) => setState(() => _hovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          color: highlight
              ? Colors.white.withValues(alpha: 0.07)
              : Colors.transparent,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (dotColor != null) ...[
                Container(
                  width: 7, height: 7,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: dotColor,
                  ),
                ),
                const SizedBox(width: 6),
              ] else ...[
                Icon(icon, size: 15,
                    color: highlight ? ZColors.foreground : ZColors.mutedForeground),
                const SizedBox(width: 6),
              ],
              Text(label,
                  style: ZText.body(12,
                      weight: FontWeight.w600,
                      color: highlight ? ZColors.foreground : ZColors.mutedForeground)),
              if (widget.server.isRunning) ...[
                const SizedBox(width: 4),
                Icon(
                  widget.dropdownOpen
                      ? Icons.keyboard_arrow_up
                      : Icons.keyboard_arrow_down,
                  size: 13,
                  color: ZColors.mutedForeground,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  (IconData, String, Color?) _resolve() {
    // Client mode
    if (widget.client.isConnected) {
      return (Icons.monitor_outlined, 'Connected', ZColors.successFg);
    }
    if (widget.client.connectionStatus == P2PConnectionStatus.connecting) {
      return (Icons.monitor_outlined, 'Connecting...', ZColors.warningFg);
    }

    // Server mode
    if (widget.server.isRunning) {
      final selected = widget.server.selectedConnection;
      if (selected != null) {
        final name = selected.deviceName ?? selected.ip;
        return (Icons.tv_outlined, name, null);
      }
      return (Icons.wifi_tethering_outlined, 'Waiting...', ZColors.warningFg);
    }

    // Off
    return (Icons.cell_tower_rounded, 'P2P', null);
  }
}

// ── Dropdown overlay ──────────────────────────────────────────────────────────

class _DropdownOverlay extends StatelessWidget {
  final LayerLink layerLink;
  final P2PServerStore server;
  final VoidCallback onClose;
  final VoidCallback onOpenSettings;

  const _DropdownOverlay({
    required this.layerLink,
    required this.server,
    required this.onClose,
    required this.onOpenSettings,
  });

  @override
  Widget build(BuildContext context) {
    final connections = server.connections
        .where((c) => c.handshake == HandshakeStatus.completed)
        .toList();
    final activeId = server.selectedDeviceId;

    return Stack(
      children: [
        Positioned.fill(
          child: GestureDetector(
            onTap: onClose,
            behavior: HitTestBehavior.translucent,
          ),
        ),
        CompositedTransformFollower(
          link: layerLink,
          showWhenUnlinked: false,
          offset: const Offset(0, 44),
          targetAnchor: Alignment.topRight,
          followerAnchor: Alignment.topRight,
          child: Material(
            color: Colors.transparent,
            child: Container(
              width: 220,
              decoration: BoxDecoration(
                color: ZColors.secondary,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: ZColors.border.withValues(alpha: 0.2)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (connections.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      child: Text(
                        'No clients connected',
                        style: ZText.body(13, color: ZColors.mutedForeground),
                      ),
                    )
                  else
                    ...connections.map((c) => _ConnectionTile(
                          connection: c,
                          isActive: c.id == activeId,
                          onTap: () {
                            server.selectDevice(c.id);
                            onClose();
                          },
                        )),
                  Container(
                    height: 1,
                    margin: const EdgeInsets.symmetric(horizontal: 10),
                    color: ZColors.border.withValues(alpha: 0.2),
                  ),
                  _DropdownItem(
                    icon: Icons.settings_outlined,
                    label: 'P2P Settings',
                    onTap: onOpenSettings,
                  ),
                  const SizedBox(height: 4),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ConnectionTile extends StatelessWidget {
  final P2PConnection connection;
  final bool isActive;
  final VoidCallback onTap;

  const _ConnectionTile({
    required this.connection,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return _DropdownItem(
      icon: Icons.tv_outlined,
      label: connection.deviceName ?? connection.ip,
      isActive: isActive,
      onTap: onTap,
    );
  }
}

class _DropdownItem extends StatefulWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _DropdownItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.isActive = false,
  });

  @override
  State<_DropdownItem> createState() => _DropdownItemState();
}

class _DropdownItemState extends State<_DropdownItem> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final highlight = widget.isActive || _hovered;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hovered = true),
      onExit:  (_) => setState(() => _hovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 100),
          margin: const EdgeInsets.fromLTRB(6, 4, 6, 0),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
          decoration: BoxDecoration(
            color: highlight ? ZColors.accent : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Icon(widget.icon, size: 15,
                  color: highlight ? ZColors.primary : ZColors.mutedForeground),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  widget.label,
                  style: ZText.body(13,
                      weight: widget.isActive ? FontWeight.w600 : FontWeight.w400,
                      color: highlight ? ZColors.primary : ZColors.foreground),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (widget.isActive)
                Icon(Icons.check, size: 13, color: ZColors.primary),
            ],
          ),
        ),
      ),
    );
  }
}
