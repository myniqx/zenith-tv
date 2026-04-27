import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../p2p/models/p2p_connection.dart';
import '../../../p2p/server/p2p_server_store.dart';
import '../../../stores/settings_store.dart';

class ServerSection extends StatelessWidget {
  const ServerSection({super.key});

  @override
  Widget build(BuildContext context) {
    final server   = context.watch<P2PServerStore>();
    final settings = context.watch<SettingsStore>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ServerControls(server: server, settings: settings),
        const SizedBox(height: 16),
        _ConnectedDevices(server: server),
        const SizedBox(height: 16),
        _TrustedClients(server: server),
      ],
    );
  }
}

// ── Server controls (start/stop, device name, port) ──────────────────────────

class _ServerControls extends StatefulWidget {
  final P2PServerStore server;
  final SettingsStore settings;
  const _ServerControls({required this.server, required this.settings});

  @override
  State<_ServerControls> createState() => _ServerControlsState();
}

class _ServerControlsState extends State<_ServerControls> {
  late TextEditingController _nameController;
  late TextEditingController _portController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.settings.deviceName);
    _portController = TextEditingController(text: widget.server.port.toString());
  }

  @override
  void dispose() {
    _nameController.dispose();
    _portController.dispose();
    super.dispose();
  }

  int get _port =>
      int.tryParse(_portController.text.trim()) ?? P2PServerStore.defaultPort;

  @override
  Widget build(BuildContext context) {
    final running  = widget.server.isRunning;
    final hasError = widget.server.error != null;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: hasError
              ? ZColors.destructive.withValues(alpha: 0.4)
              : ZColors.border.withValues(alpha: 0.15),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 8, height: 8,
                decoration: BoxDecoration(
                  color: running
                      ? ZColors.successFg
                      : hasError
                          ? ZColors.destructiveFg
                          : ZColors.mutedForeground,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  running ? 'Running on port ${widget.server.port}' : 'Server stopped',
                  style: ZText.body(14, weight: FontWeight.w600),
                ),
              ),
            ],
          ),
          if (hasError) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: ZColors.destructive.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, size: 14, color: ZColors.destructiveFg),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(widget.server.error!,
                        style: ZText.body(12, color: ZColors.destructiveFg)),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          TextField(
            controller: _nameController,
            enabled: !running,
            style: ZText.body(14),
            decoration: const InputDecoration(labelText: 'Device Name', hintText: 'Zenith Device'),
            onChanged: widget.settings.setDeviceName,
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _portController,
            enabled: !running,
            style: ZText.body(14),
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Port',
              hintText: '${P2PServerStore.defaultPort}',
              helperText: hasError ? 'Try a different port' : null,
              helperStyle: ZText.body(11, color: ZColors.destructiveFg),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(Icons.power_settings_new_outlined, size: 14, color: ZColors.mutedForeground),
              const SizedBox(width: 8),
              Expanded(
                child: Text('Auto-start on launch',
                    style: ZText.body(13, color: ZColors.foreground)),
              ),
              Switch(
                value: widget.server.autoStart,
                onChanged: (v) => widget.server.setAutoStart(v),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: running
                ? OutlinedButton(
                    onPressed: widget.server.stopServer,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: ZColors.destructiveFg,
                      side: BorderSide(color: ZColors.destructive.withValues(alpha: 0.5)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('Stop Server'),
                  )
                : ElevatedButton(
                    onPressed: () => widget.server.startServer(
                      deviceName: widget.settings.deviceName,
                      port: _port,
                    ),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('Start Server'),
                  ),
          ),
        ],
      ),
    );
  }
}

// ── Connected devices ─────────────────────────────────────────────────────────

class _ConnectedDevices extends StatelessWidget {
  final P2PServerStore server;
  const _ConnectedDevices({required this.server});

  @override
  Widget build(BuildContext context) {
    final connections = server.connections;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Connected Devices (${connections.length})',
              style: ZText.body(14, weight: FontWeight.w600)),
          const SizedBox(height: 12),
          if (connections.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Center(
                child: Text(
                  'No devices connected.\nTV or tablet will appear here when connected.',
                  textAlign: TextAlign.center,
                  style: ZText.body(13, color: ZColors.mutedForeground),
                ),
              ),
            )
          else
            ...connections.map((c) => _DeviceTile(connection: c, server: server)),
        ],
      ),
    );
  }
}

class _DeviceTile extends StatelessWidget {
  final P2PConnection connection;
  final P2PServerStore server;
  const _DeviceTile({required this.connection, required this.server});

  @override
  Widget build(BuildContext context) {
    final isSelected = server.selectedDeviceId == connection.id;
    final isPending  = connection.handshake == HandshakeStatus.pending;
    final isTrusted  = connection.deviceId != null &&
        server.isTrusted(connection.deviceId!);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: isSelected ? ZColors.accent : ZColors.muted,
        borderRadius: BorderRadius.circular(10),
        border: isSelected
            ? Border.all(color: ZColors.primary.withValues(alpha: 0.4))
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isPending ? Icons.hourglass_empty : Icons.tv_outlined,
                color: isPending ? ZColors.warningFg : ZColors.mutedForeground,
                size: 18,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isPending
                          ? 'Waiting for handshake...'
                          : (connection.deviceName ?? connection.ip),
                      style: ZText.body(13, weight: FontWeight.w600,
                          color: isPending ? ZColors.mutedForeground : ZColors.foreground),
                    ),
                    Text(connection.ip, style: ZText.bodySm),
                  ],
                ),
              ),

              // Active indicator
              if (isSelected && !isPending)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: ZColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text('Active',
                      style: ZText.body(11, weight: FontWeight.w700, color: ZColors.primary)),
                )
              else if (!isPending && !isSelected)
                TextButton(
                  onPressed: () => server.selectDevice(connection.id),
                  child: const Text('Set Active'),
                ),

              // Disconnect
              if (!isPending)
                IconButton(
                  onPressed: () => server.closeConnection(connection.id),
                  icon: const Icon(Icons.close, size: 14),
                  color: ZColors.mutedForeground,
                  padding: const EdgeInsets.all(4),
                  constraints: const BoxConstraints(),
                ),
            ],
          ),

          // Trust button — only shown after handshake, not yet trusted
          if (!isPending && !isTrusted) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.verified_user_outlined, size: 14),
                label: const Text('Trust This Device'),
                onPressed: () => _onTrust(context, connection.id),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  backgroundColor: ZColors.primary,
                  foregroundColor: ZColors.primaryForeground,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _onTrust(BuildContext context, String connectionId) {
    // trustClient persists the trust and fires onTrusted callback →
    // P2PManager.sendWelcomeToConnection via the wired callback in main.dart
    server.trustClient(connectionId);
  }
}

// ── Trusted clients list ──────────────────────────────────────────────────────

class _TrustedClients extends StatelessWidget {
  final P2PServerStore server;
  const _TrustedClients({required this.server});

  @override
  Widget build(BuildContext context) {
    final trusted = server.trustedClients;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.verified_user_outlined, size: 14, color: ZColors.primary),
              const SizedBox(width: 6),
              Text('Trusted Clients', style: ZText.body(14, weight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 12),
          if (trusted.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: Text(
                  'No trusted clients yet.\nTrust a connected device to allow automatic access.',
                  textAlign: TextAlign.center,
                  style: ZText.body(13, color: ZColors.mutedForeground),
                ),
              ),
            )
          else
            ...trusted.map((c) => _TrustedClientTile(client: c, server: server)),
        ],
      ),
    );
  }
}

class _TrustedClientTile extends StatelessWidget {
  final TrustedClient client;
  final P2PServerStore server;
  const _TrustedClientTile({required this.client, required this.server});

  @override
  Widget build(BuildContext context) {
    final isOnline = server.connections
        .any((c) => c.deviceId == client.deviceId);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: ZColors.muted,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Container(
            width: 7, height: 7,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isOnline ? ZColors.successFg : ZColors.mutedForeground,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(client.deviceName,
                    style: ZText.body(13, weight: FontWeight.w600)),
                Text(client.deviceId,
                    style: ZText.body(10, color: ZColors.mutedForeground),
                    overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          IconButton(
            onPressed: () => server.removeTrustedClient(client.deviceId),
            icon: const Icon(Icons.delete_outline, size: 16),
            color: ZColors.mutedForeground,
            padding: const EdgeInsets.all(4),
            constraints: const BoxConstraints(),
            tooltip: 'Remove',
          ),
        ],
      ),
    );
  }
}
