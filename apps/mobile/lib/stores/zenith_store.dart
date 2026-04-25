import 'package:flutter/foundation.dart';

enum P2PUIMode { off, server, client }

/// App-wide UI state store — not persisted, resets on app restart.
/// Holds transient state that multiple widgets need to share but
/// doesn't belong in domain stores (settings, content, player).
class ZenithStore extends ChangeNotifier {
  // Current P2P panel selection — drives RemoteControl UI layout.
  // Distinct from UniversalPlayerStore.mode which reflects active connections.
  P2PUIMode _p2pUIMode = P2PUIMode.off;
  P2PUIMode get p2pUIMode => _p2pUIMode;

  void setP2PUIMode(P2PUIMode mode) {
    if (_p2pUIMode == mode) return;
    _p2pUIMode = mode;
    notifyListeners();
  }
}
