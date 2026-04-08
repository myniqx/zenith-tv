enum DeviceType { tv, tablet, phone }

/// Detects device type at startup.
/// TV detection uses Android UiModeManager via platform check.
/// Tablet/phone distinction is based on shortest side >= 600dp.
///
/// Mirrors: apps/tizen/src/App.tsx (TV check) + desktop mode switching logic
class DeviceTypeDetector {
  static DeviceType? _cached;

  static DeviceType get current => _cached ?? DeviceType.phone;

  static void detect(double shortestSide) {
    if (_cached != null) return;

    // On Android we can't call UiModeManager from pure Dart without a plugin.
    // We approximate: if running on Android and screen is TV-sized (landscape,
    // large), treat as tablet/phone. Real TV detection requires a MethodChannel
    // (Step 2 native plugin — deferred). For now, use screen size heuristic.
    if (shortestSide >= 600) {
      _cached = DeviceType.tablet;
    } else {
      _cached = DeviceType.phone;
    }
  }

  /// Override for testing or when native channel result arrives.
  static void forceType(DeviceType type) {
    _cached = type;
  }

  static bool get isTV => current == DeviceType.tv;
  static bool get isTablet => current == DeviceType.tablet;
  static bool get isPhone => current == DeviceType.phone;

  /// Phone and tablet can act as P2P server (controller mode).
  static bool get canBeServer => current != DeviceType.tv;
}
