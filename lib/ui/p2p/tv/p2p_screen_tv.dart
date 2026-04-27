import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';
import '../../../core/tv_focus.dart';
import '../../../p2p/client/p2p_client_store.dart';
import '../../../p2p/client/p2p_client.dart';
import '../../../p2p/client/trusted_server.dart';
import '../../../p2p/models/discovered_controller.dart';
import '../../../p2p/server/p2p_server_store.dart';

class P2PScreenTv extends StatefulWidget {
  final P2PClientStore clientStore;
  final P2PServerStore serverStore;

  const P2PScreenTv({
    super.key,
    required this.clientStore,
    required this.serverStore,
  });

  @override
  State<P2PScreenTv> createState() => _P2PScreenTvState();
}

class _P2PScreenTvState extends State<P2PScreenTv> {
  final _manualIpCtrl = TextEditingController();

  @override
  void dispose() {
    _manualIpCtrl.dispose();
    super.dispose();
  }

  void _connectManual() {
    final ip = _manualIpCtrl.text.trim();
    if (ip.isEmpty) return;
    widget.clientStore.connect(DiscoveredController(
      deviceId: 'manual-$ip', deviceName: 'Manuel ($ip)',
      ip: ip, port: 8080, version: '1.0.0',
    ));
  }

  @override
  Widget build(BuildContext context) {
    return TvFocusScope(
      child: Scaffold(
        backgroundColor: ZColors.background,
        body: Padding(
          padding: const EdgeInsets.fromLTRB(48, 32, 48, 32),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Sol panel: bağlantı durumu + manuel bağlan
              SizedBox(
                width: 360,
                child: TvVerticalList(
                  children: [
                    Text('P2P', style: ZText.headline(28)),
                    const SizedBox(height: 4),
                    Text('Sunuculara bağlanın',
                        style: ZText.body(15, color: ZColors.mutedForeground)),
                    const SizedBox(height: 24),
                    _TvClientStatusCard(store: widget.clientStore),
                    const SizedBox(height: 16),
                    _TvManualConnectCard(
                      controller: _manualIpCtrl,
                      onConnect: _connectManual,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 32),
              // Sağ panel: keşfedilen sunucular listesi
              Expanded(
                child: _TvDiscoveredServersPanel(store: widget.clientStore),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── TV bağlantı durumu kartı ──────────────────────────────────────────────────

class _TvClientStatusCard extends StatelessWidget {
  final P2PClientStore store;
  const _TvClientStatusCard({required this.store});

  @override
  Widget build(BuildContext context) {
    final status  = store.connectionStatus;
    final current = store.currentServer;

    final (dotColor, label) = switch (status) {
      P2PConnectionStatus.connected  => (ZColors.successFg, current != null ? '${current.deviceName} (${current.ip})' : 'Bağlı'),
      P2PConnectionStatus.connecting => (ZColors.warningFg, 'Bağlanıyor...'),
      P2PConnectionStatus.error      => (ZColors.warningFg, store.error ?? 'Bağlantı hatası'),
      _                              => (ZColors.mutedForeground, 'Bağlı değil'),
    };

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 10, height: 10,
                decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(label, style: ZText.body(16, weight: FontWeight.w600))),
            ],
          ),
          if (status == P2PConnectionStatus.connected) ...[
            const SizedBox(height: 16),
            TvButton(
              label: 'Bağlantıyı Kes',
              icon: Icons.link_off_rounded,
              onSelect: store.disconnect,
            ),
          ],
        ],
      ),
    );
  }
}

// ── TV manuel bağlantı kartı ──────────────────────────────────────────────────

class _TvManualConnectCard extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onConnect;

  const _TvManualConnectCard({required this.controller, required this.onConnect});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Manuel Bağlan', style: ZText.body(16, weight: FontWeight.w600)),
          const SizedBox(height: 14),
          TextField(
            controller: controller,
            style: ZText.body(16),
            decoration: const InputDecoration(hintText: '192.168.1.X'),
            keyboardType: TextInputType.number,
            onSubmitted: (_) => onConnect(),
          ),
          const SizedBox(height: 14),
          TvButton(
            label: 'Bağlan',
            icon: Icons.link_rounded,
            onSelect: onConnect,
          ),
        ],
      ),
    );
  }
}

// ── TV sunucu listesi paneli ──────────────────────────────────────────────────

class _TvDiscoveredServersPanel extends StatelessWidget {
  final P2PClientStore store;
  const _TvDiscoveredServersPanel({required this.store});

  @override
  Widget build(BuildContext context) {
    final allServers = [
      ...store.trustedServers,
      ...store.discoveredServers.where(
          (d) => !store.trustedServers.any((t) => t.deviceId == d.deviceId)),
    ];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Cihazlar', style: ZText.body(18, weight: FontWeight.w600)),
              TvButton(
                label: store.isScanning ? 'Taranıyor...' : 'Tara',
                icon: Icons.refresh_rounded,
                onSelect: store.isScanning ? null : store.scan,
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (allServers.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: Center(
                child: Text(
                  'Cihaz bulunamadı.\nDiğer cihazda uygulamanın açık olduğundan emin olun.',
                  textAlign: TextAlign.center,
                  style: ZText.body(14, color: ZColors.mutedForeground),
                ),
              ),
            )
          else
            TvVerticalList(
              children: allServers
                  .map((s) => _TvServerTile(server: s, store: store))
                  .toList(),
            ),
        ],
      ),
    );
  }
}

// ── TV sunucu tile — TvFocusable ile ─────────────────────────────────────────

class _TvServerTile extends StatelessWidget {
  final dynamic server;
  final P2PClientStore store;

  const _TvServerTile({required this.server, required this.store});

  String get _id   => server is TrustedServer ? server.deviceId  : (server as DiscoveredController).deviceId;
  String get _name => server is TrustedServer ? server.deviceName : (server as DiscoveredController).deviceName;
  String get _ip   => server is TrustedServer ? server.ip         : (server as DiscoveredController).ip;
  int    get _port => server is TrustedServer ? server.port       : (server as DiscoveredController).port;

  void _connect() {
    if (server is TrustedServer) {
      store.connectToTrusted(server as TrustedServer);
    } else {
      store.connect(server as DiscoveredController);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isTrusted   = store.trustedServers.any((t) => t.deviceId == _id);
    final trusted     = store.trustedServers.where((t) => t.deviceId == _id).firstOrNull;
    final isConnected = store.currentServer?.deviceId == _id;

    return TvFocusable(
      onSelect: isConnected ? null : _connect,
      builder: (context, focused) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: focused
              ? ZColors.accent
              : isConnected
                  ? ZColors.primary.withValues(alpha: 0.1)
                  : ZColors.muted,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: focused || isConnected
                ? ZColors.primary.withValues(alpha: 0.4)
                : Colors.transparent,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_name,
                      style: ZText.body(18, weight: FontWeight.w600,
                          color: focused || isConnected ? ZColors.primary : ZColors.foreground)),
                  const SizedBox(height: 2),
                  Text('$_ip:$_port', style: ZText.bodySm),
                  if (isTrusted)
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: ZColors.success,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text('Kayıtlı',
                          style: ZText.body(10, weight: FontWeight.w700, color: ZColors.successFg)),
                    ),
                ],
              ),
            ),
            if (isTrusted && trusted != null)
              Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: trusted.autoConnect ? ZColors.accent : ZColors.secondary,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text('Oto',
                    style: ZText.body(12, weight: FontWeight.w600,
                        color: trusted.autoConnect ? ZColors.primary : ZColors.mutedForeground)),
              ),
            if (isConnected)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: ZColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text('Bağlı',
                    style: ZText.body(13, weight: FontWeight.w700, color: ZColors.primary)),
              )
            else
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: focused ? ZColors.primary : ZColors.muted,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text('Bağlan',
                    style: ZText.body(13, weight: FontWeight.w600,
                        color: focused ? ZColors.primaryForeground : ZColors.mutedForeground)),
              ),
            if (isTrusted) ...[
              const SizedBox(width: 8),
              IconButton(
                onPressed: () => store.removeTrustedServer(_id),
                icon: const Icon(Icons.close_rounded, size: 18),
                color: ZColors.mutedForeground,
                padding: const EdgeInsets.all(4),
                constraints: const BoxConstraints(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
