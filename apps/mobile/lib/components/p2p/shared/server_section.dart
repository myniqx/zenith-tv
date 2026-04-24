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
      ],
    );
  }
}

class _ServerControls extends StatefulWidget {
  final P2PServerStore server;
  final SettingsStore settings;
  const _ServerControls({required this.server, required this.settings});

  @override
  State<_ServerControls> createState() => _ServerControlsState();
}

class _ServerControlsState extends State<_ServerControls> {
  late TextEditingController _nameController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.settings.deviceName);
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final running = widget.server.isRunning;

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
              Container(
                width: 8, height: 8,
                decoration: BoxDecoration(
                  color: running ? ZColors.successFg : ZColors.mutedForeground,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  running
                      ? 'Running on port ${widget.server.port}'
                      : 'Server stopped',
                  style: ZText.body(14, weight: FontWeight.w600),
                ),
              ),
            ],
          ),
          if (widget.server.error != null) ...[
            const SizedBox(height: 6),
            Text(widget.server.error!, style: ZText.body(12, color: ZColors.destructiveFg)),
          ],
          const SizedBox(height: 16),

          // Device name field
          TextField(
            controller: _nameController,
            enabled: !running,
            style: ZText.body(14),
            decoration: const InputDecoration(
              labelText: 'Device Name',
              hintText: 'Zenith Device',
            ),
            onChanged: widget.settings.setDeviceName,
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
          Text(
            'Connected Devices (${connections.length})',
            style: ZText.body(14, weight: FontWeight.w600),
          ),
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
      child: Row(
        children: [
          const Icon(Icons.tv_outlined, color: ZColors.mutedForeground, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(connection.deviceName ?? connection.ip,
                    style: ZText.body(13, weight: FontWeight.w600)),
                Text(connection.ip, style: ZText.bodySm),
              ],
            ),
          ),
          if (isSelected)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: ZColors.primary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('Active',
                  style: ZText.body(11, weight: FontWeight.w700, color: ZColors.primary)),
            )
          else
            TextButton(
              onPressed: () => server.selectDevice(connection.id),
              child: const Text('Set Active'),
            ),
        ],
      ),
    );
  }
}
