import 'package:flutter/foundation.dart';

enum LogChannel { app, p2p }

class LogEntry {
  final LogChannel channel;
  final String message;
  final DateTime time;
  final bool isError;

  LogEntry({
    required this.channel,
    required this.message,
    required this.isError,
  }) : time = DateTime.now();
}

/// Singleton log collector — debug builds only.
/// Use [AppLogger.app] / [AppLogger.p2p] anywhere in the codebase.
class AppLogger extends ChangeNotifier {
  static final AppLogger instance = AppLogger._();
  AppLogger._();

  static const _maxEntries = 200;

  final List<LogEntry> _entries = [];
  List<LogEntry> get entries => List.unmodifiable(_entries);

  List<LogEntry> forChannel(LogChannel channel) =>
      _entries.where((e) => e.channel == channel).toList();

  static void app(String message, {bool error = false}) {
    if (!kDebugMode) return;
    instance._add(LogChannel.app, message, error);
    // Also print to console
    debugPrint('[APP] $message');
  }

  static void p2p(String message, {bool error = false}) {
    if (!kDebugMode) return;
    instance._add(LogChannel.p2p, message, error);
    debugPrint('[P2P] $message');
  }

  void _add(LogChannel channel, String message, bool isError) {
    _entries.add(LogEntry(channel: channel, message: message, isError: isError));
    if (_entries.length > _maxEntries) {
      _entries.removeRange(0, _entries.length - _maxEntries);
    }
    notifyListeners();
  }

  void clear(LogChannel channel) {
    _entries.removeWhere((e) => e.channel == channel);
    notifyListeners();
  }

  void clearAll() {
    _entries.clear();
    notifyListeners();
  }
}
