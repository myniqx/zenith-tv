import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app_theme.dart';
import 'device_type.dart';

/// Debug overlay — only rendered in debug builds.
/// A thin tab on the left edge opens an animated panel for dev overrides.
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
              // Sliding panel
              SizeTransition(
                sizeFactor: _slide,
                axis: Axis.horizontal,
                child: _PanelContent(onClose: _toggle),
              ),
              // Edge tab — always visible
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

class _PanelContent extends StatelessWidget {
  final VoidCallback onClose;
  const _PanelContent({required this.onClose});

  @override
  Widget build(BuildContext context) {
    final detector = context.watch<DeviceTypeDetector>();

    return Container(
      width: 220,
      decoration: BoxDecoration(
        color: ZColors.secondary,
        border: Border(
          right: BorderSide(color: ZColors.border.withValues(alpha: 0.2)),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Debug', style: ZText.labelUpper),
              const Spacer(),
              GestureDetector(
                onTap: onClose,
                child: Icon(Icons.close, size: 16, color: ZColors.mutedForeground),
              ),
            ],
          ),
          const SizedBox(height: 20),

          Text('Device Type', style: ZText.body(12, color: ZColors.mutedForeground)),
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
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: ZColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text('auto',
                    style: ZText.body(10, color: ZColors.primary)),
              ),
            if (_isActive && hasOverride)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
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
