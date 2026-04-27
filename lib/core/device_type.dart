import 'package:flutter/foundation.dart';
import 'dart:io';

enum DeviceType { tv, tablet, phone }

/// Detects device type at startup and notifies listeners when overridden.
/// TV detection uses Android UiModeManager via platform check.
/// Tablet/phone distinction is based on shortest side >= 600dp.
/// Linux/Windows always resolves to tablet (desktop = full layout).
///
/// P2P role capabilities per form factor:
///   phone  — server only  (acts as remote control; no local video playback)
///   tablet — server + client  (full desktop-equivalent; both roles)
///   tv     — client only  (plays video; cannot act as remote control)
class DeviceTypeDetector extends ChangeNotifier {
  static DeviceTypeDetector? _instance;
  static DeviceTypeDetector get instance => _instance ??= DeviceTypeDetector._();

  DeviceTypeDetector._();

  DeviceType? _detected;
  DeviceType? _override;

  DeviceType get current => _override ?? _detected ?? DeviceType.phone;

  void detect(double shortestSide) {
    if (_detected != null) return;

    if (!kIsWeb && (Platform.isLinux || Platform.isWindows || Platform.isMacOS)) {
      _detected = DeviceType.tablet;
    } else if (shortestSide >= 600) {
      _detected = DeviceType.tablet;
    } else {
      _detected = DeviceType.phone;
    }
  }

  void setOverride(DeviceType? type) {
    _override = type;
    notifyListeners();
  }

  DeviceType get detected => _detected ?? DeviceType.phone;
  bool get hasOverride => _override != null;

  bool get isTV => current == DeviceType.tv;
  bool get isTablet => current == DeviceType.tablet;
  bool get isPhone => current == DeviceType.phone;

  bool get canBeServer => current == DeviceType.phone || current == DeviceType.tablet;
  bool get canBeClient => current == DeviceType.tablet || current == DeviceType.tv;
}
