import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app_theme.dart';
import 'app_logger.dart';
import 'device_type.dart';

/// Debug overlay — only rendered in debug builds.
class DebugPanel extends StatefulWidget {
  final Widget child;
  const DebugPanel({super.key, required this.child});

  @override
  State<DebugPanel> createState() => _DebugPanelState();
}

class _DebugPanelState extends State<DebugPanel>
    with SingleTickerProviderStateMixin {
  bool _open = false;
  late final AnimationController _ctrl;
  late final Animation<double> _slide;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );
    _slide = CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _toggle() {
    setState(() => _open = !_open);
    _open ? _ctrl.forward() : _ctrl.reverse();
  }

  @override
  Widget build(BuildContext context) {
    if (!kDebugMode) return widget.child;

    return Stack(
      children: [
        widget.child,
        Positioned(
          left: 0,
          top: 0,
          bottom: 0,
          child: Row(
            children: [
              SizeTransition(
                sizeFactor: _slide,
                axis: Axis.horizontal,
                child: _PanelContent(onClose: _toggle),
              ),
              GestureDetector(
                onTap: _toggle,
                child: Container(
                  width: 6,
                  decoration: BoxDecoration(
                    color: ZColors.primary.withValues(alpha: _open ? 0.8 : 0.35),
                    borderRadius: const BorderRadius.horizontal(
                      right: Radius.circular(4),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Panel ─────────────────────────────────────────────────────────────────────

class _PanelContent extends StatefulWidget {
  final VoidCallback onClose;
  const _PanelContent({required this.onClose});

  @override
  State<_PanelContent> createState() => _PanelContentState();
}

class _PanelContentState extends State<_PanelContent> {
  int _tab = 0; // 0=device, 1=app log, 2=p2p log

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 320,
      decoration: BoxDecoration(
        color: ZColors.secondary,
        border: Border(
          right: BorderSide(color: ZColors.border.withValues(alpha: 0.2)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 12, 0),
            child: Row(
              children: [
                Text('Debug', style: ZText.labelUpper),
                const Spacer(),
                GestureDetector(
                  onTap: widget.onClose,
                  child: const Icon(Icons.close,
                      size: 16, color: ZColors.mutedForeground),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Tab bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                _Tab(label: 'Device', active: _tab == 0, onTap: () => setState(() => _tab = 0)),
                const SizedBox(width: 4),
                _Tab(label: 'App', active: _tab == 1, onTap: () => setState(() => _tab = 1)),
                const SizedBox(width: 4),
                _Tab(label: 'P2P', active: _tab == 2, onTap: () => setState(() => _tab = 2)),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Content
          Expanded(
            child: switch (_tab) {
              0 => _DeviceTab(),
              1 => _LogTab(channel: LogChannel.app),
              _ => _LogTab(channel: LogChannel.p2p),
            },
          ),
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _Tab({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: active ? ZColors.accent : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: ZText.body(12,
              weight: active ? FontWeight.w700 : FontWeight.w400,
              color: active ? ZColors.primary : ZColors.mutedForeground),
        ),
      ),
    );
  }
}

// ── Device tab ────────────────────────────────────────────────────────────────

class _DeviceTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final detector = context.watch<DeviceTypeDetector>();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Device Type',
              style: ZText.body(12, color: ZColors.mutedForeground)),
          const SizedBox(height: 8),
          ...DeviceType.values.map((type) => _TypeOption(
                type: type,
                current: detector.current,
                detected: detector.detected,
                hasOverride: detector.hasOverride,
                onTap: () => detector.setOverride(
                  detector.current == type && detector.hasOverride ? null : type,
                ),
              )),
        ],
      ),
    );
  }
}

// ── Log tab ───────────────────────────────────────────────────────────────────

class _LogTab extends StatefulWidget {
  final LogChannel channel;
  const _LogTab({required this.channel});

  @override
  State<_LogTab> createState() => _LogTabState();
}

class _LogTabState extends State<_LogTab> {
  final ScrollController _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppLogger.instance,
      builder: (context, _) {
        final entries = AppLogger.instance.forChannel(widget.channel);
        _scrollToBottom();

        return Column(
          children: [
            // Clear button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  Text('${entries.length} entries',
                      style: ZText.body(11, color: ZColors.mutedForeground)),
                  const Spacer(),
                  GestureDetector(
                    onTap: () => AppLogger.instance.clear(widget.channel),
                    child: Text('Clear',
                        style: ZText.body(11, color: ZColors.primary)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 6),

            // Log list
            Expanded(
              child: entries.isEmpty
                  ? Center(
                      child: Text('No logs',
                          style: ZText.body(12,
                              color: ZColors.mutedForeground)),
                    )
                  : ListView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      itemCount: entries.length,
                      itemBuilder: (_, i) => _LogEntry(entry: entries[i]),
                    ),
            ),
          ],
        );
      },
    );
  }
}

class _LogEntry extends StatelessWidget {
  final LogEntry entry;
  const _LogEntry({required this.entry});

  @override
  Widget build(BuildContext context) {
    final t = entry.time;
    final ts =
        '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}:${t.second.toString().padLeft(2, '0')}';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(ts,
              style: ZText.body(10,
                  color: ZColors.mutedForeground,
                  weight: FontWeight.w500)),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              entry.message,
              style: ZText.body(11,
                  color: entry.isError
                      ? const Color(0xFFFCA5A5)
                      : ZColors.foreground),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Device type option ────────────────────────────────────────────────────────

class _TypeOption extends StatelessWidget {
  final DeviceType type;
  final DeviceType current;
  final DeviceType detected;
  final bool hasOverride;
  final VoidCallback onTap;

  const _TypeOption({
    required this.type,
    required this.current,
    required this.detected,
    required this.hasOverride,
    required this.onTap,
  });

  String get _label => switch (type) {
        DeviceType.phone => 'Phone',
        DeviceType.tablet => 'Tablet',
        DeviceType.tv => 'TV',
      };

  bool get _isActive => current == type;
  bool get _isDetected => detected == type && !hasOverride;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: _isActive ? ZColors.accent : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: _isActive
                ? ZColors.primary.withValues(alpha: 0.4)
                : ZColors.border.withValues(alpha: 0.15),
          ),
        ),
        child: Row(
          children: [
            Text(
              _label,
              style: ZText.body(13,
                  weight: _isActive ? FontWeight.w700 : FontWeight.w400,
                  color: _isActive ? ZColors.primary : ZColors.mutedForeground),
            ),
            const Spacer(),
            if (_isDetected)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: ZColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text('auto',
                    style: ZText.body(10, color: ZColors.primary)),
              ),
            if (_isActive && hasOverride)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: ZColors.successFg.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text('override',
                    style: ZText.body(10, color: ZColors.successFg)),
              ),
          ],
        ),
      ),
    );
  }
}
