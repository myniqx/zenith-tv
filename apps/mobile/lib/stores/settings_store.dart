import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

enum AppLanguage { en, tr }

enum ShortcutAction {
  playPause,
  stop,
  seekForward,
  seekBackward,
  seekForwardSmall,
  seekBackwardSmall,
  volumeUp,
  volumeDown,
  toggleMute,
  toggleFullscreen,
  exitFullscreen,
  subtitleDelayPlus,
  subtitleDelayMinus,
  subtitleDisable,
}

const defaultKeyboardShortcuts = <ShortcutAction, List<String>>{
  ShortcutAction.playPause:         ['Space', 'KeyK'],
  ShortcutAction.stop:              ['KeyS'],
  ShortcutAction.seekForward:       ['ArrowRight'],
  ShortcutAction.seekBackward:      ['ArrowLeft'],
  ShortcutAction.seekForwardSmall:  ['shift+ArrowRight'],
  ShortcutAction.seekBackwardSmall: ['shift+ArrowLeft'],
  ShortcutAction.volumeUp:          ['ArrowUp'],
  ShortcutAction.volumeDown:        ['ArrowDown'],
  ShortcutAction.toggleMute:        ['KeyM'],
  ShortcutAction.toggleFullscreen:  ['KeyF', 'F11'],
  ShortcutAction.exitFullscreen:    ['Escape'],
  ShortcutAction.subtitleDelayPlus: ['KeyH'],
  ShortcutAction.subtitleDelayMinus:['KeyG'],
  ShortcutAction.subtitleDisable:   ['KeyV'],
};

// ---------------------------------------------------------------------------
// SettingsStore
// ---------------------------------------------------------------------------

class SettingsStore extends ChangeNotifier {
  static const _prefsKey = 'zenith-settings';

  // Appearance
  String language = 'en';

  // P2P
  String deviceName = 'Zenith Device';

  // Playback
  double defaultVolume = 0.7;
  bool autoResume = true;
  bool autoPlayNext = true;
  List<String> preferredAudioLanguages = [];
  List<String> preferredSubtitleLanguages = [];

  // Subtitle appearance
  double subtitleFontSize = 24.0;
  bool subtitleBold = false;
  String subtitleTextAlign = 'center'; // left | center | right
  int subtitleTextColor = 0xffffffff;
  int subtitleBgColor = 0xaa000000;

  // Startup
  bool autoLoadLastProfile = false;
  bool rememberLayout = false;
  String? lastProfileUsername;
  String? lastProfileUUID;

  // Layout (only persisted when rememberLayout is true)
  double categoryWidth = 200;
  double videoWidth = 360;

  static const double defaultCategoryWidth = 200;
  static const double defaultVideoWidth    = 360;
  static const double _defaultCategoryWidth = defaultCategoryWidth;
  static const double _defaultVideoWidth    = defaultVideoWidth;

  // Keyboard shortcuts (desktop only)
  Map<ShortcutAction, List<String>> keyboardShortcuts =
      Map.from(defaultKeyboardShortcuts);

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw == null) return;

    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      language                  = json['language'] as String? ?? language;
      deviceName                = json['deviceName'] as String? ?? deviceName;
      defaultVolume             = (json['defaultVolume'] as num?)?.toDouble() ?? defaultVolume;
      autoResume                = json['autoResume'] as bool? ?? autoResume;
      autoPlayNext              = json['autoPlayNext'] as bool? ?? autoPlayNext;
      preferredAudioLanguages    = (json['preferredAudioLanguages'] as List?)?.cast<String>() ?? [];
      preferredSubtitleLanguages = (json['preferredSubtitleLanguages'] as List?)?.cast<String>() ?? [];
      subtitleFontSize  = (json['subtitleFontSize']  as num?)?.toDouble() ?? subtitleFontSize;
      subtitleBold      = json['subtitleBold']      as bool? ?? subtitleBold;
      subtitleTextAlign = json['subtitleTextAlign'] as String? ?? subtitleTextAlign;
      subtitleTextColor = (json['subtitleTextColor'] as num?)?.toInt() ?? subtitleTextColor;
      subtitleBgColor   = (json['subtitleBgColor']   as num?)?.toInt() ?? subtitleBgColor;
      autoLoadLastProfile       = json['autoLoadLastProfile'] as bool? ?? autoLoadLastProfile;
      rememberLayout            = json['rememberLayout'] as bool? ?? rememberLayout;
      lastProfileUsername       = json['lastProfileUsername'] as String?;
      lastProfileUUID           = json['lastProfileUUID'] as String?;
      if (rememberLayout) {
        categoryWidth = (json['categoryWidth'] as num?)?.toDouble() ?? _defaultCategoryWidth;
        videoWidth    = (json['videoWidth']    as num?)?.toDouble() ?? _defaultVideoWidth;
      }

      final shortcuts = json['keyboardShortcuts'] as Map<String, dynamic>?;
      if (shortcuts != null) {
        for (final action in ShortcutAction.values) {
          final keys = shortcuts[action.name] as List<dynamic>?;
          if (keys != null) {
            keyboardShortcuts[action] = keys.cast<String>();
          }
        }
      }
    } catch (_) {}

    notifyListeners();
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    final shortcuts = <String, List<String>>{
      for (final e in keyboardShortcuts.entries) e.key.name: e.value,
    };
    await prefs.setString(_prefsKey, jsonEncode({
      'language':                  language,
      'deviceName':                deviceName,
      'defaultVolume':             defaultVolume,
      'autoResume':                autoResume,
      'autoPlayNext':              autoPlayNext,
      'preferredAudioLanguages':    preferredAudioLanguages,
      'preferredSubtitleLanguages': preferredSubtitleLanguages,
      'autoLoadLastProfile':       autoLoadLastProfile,
      'rememberLayout':            rememberLayout,
      'lastProfileUsername':       lastProfileUsername,
      'lastProfileUUID':           lastProfileUUID,
      'categoryWidth':             categoryWidth,
      'videoWidth':                videoWidth,
      'keyboardShortcuts':         shortcuts,
      'subtitleFontSize':          subtitleFontSize,
      'subtitleBold':              subtitleBold,
      'subtitleTextAlign':         subtitleTextAlign,
      'subtitleTextColor':         subtitleTextColor,
      'subtitleBgColor':           subtitleBgColor,
    }));
  }

  // ---------------------------------------------------------------------------
  // Setters
  // ---------------------------------------------------------------------------

  void setLanguage(String v)                    { language = v; _notify(); }
  void setDeviceName(String v)                  { deviceName = v.trim().isEmpty ? 'Zenith Device' : v.trim(); _notify(); }
  void setDefaultVolume(double v)               { defaultVolume = v.clamp(0.0, 1.0); _notify(); }
  void setAutoResume(bool v)                    { autoResume = v; _notify(); }
  void setAutoPlayNext(bool v)                  { autoPlayNext = v; _notify(); }
  void addPreferredAudioLanguage(String v) {
    if (!preferredAudioLanguages.contains(v)) {
      preferredAudioLanguages = [...preferredAudioLanguages, v];
      _notify();
    }
  }

  void removePreferredAudioLanguage(String v) {
    preferredAudioLanguages = preferredAudioLanguages.where((l) => l != v).toList();
    _notify();
  }

  void reorderPreferredAudioLanguages(int oldIndex, int newIndex) {
    final list = [...preferredAudioLanguages];
    if (newIndex > oldIndex) newIndex--;
    final item = list.removeAt(oldIndex);
    list.insert(newIndex, item);
    preferredAudioLanguages = list;
    _notify();
  }

  void addPreferredSubtitleLanguage(String v) {
    if (!preferredSubtitleLanguages.contains(v)) {
      preferredSubtitleLanguages = [...preferredSubtitleLanguages, v];
      _notify();
    }
  }

  void removePreferredSubtitleLanguage(String v) {
    preferredSubtitleLanguages = preferredSubtitleLanguages.where((l) => l != v).toList();
    _notify();
  }

  void reorderPreferredSubtitleLanguages(int oldIndex, int newIndex) {
    final list = [...preferredSubtitleLanguages];
    if (newIndex > oldIndex) newIndex--;
    final item = list.removeAt(oldIndex);
    list.insert(newIndex, item);
    preferredSubtitleLanguages = list;
    _notify();
  }
  void setSubtitleFontSize(double v)            { subtitleFontSize = v.clamp(12.0, 48.0); _notify(); }
  void setSubtitleBold(bool v)                  { subtitleBold = v; _notify(); }
  void setSubtitleTextAlign(String v)           { subtitleTextAlign = v; _notify(); }
  void setSubtitleTextColor(int v)              { subtitleTextColor = v; _notify(); }
  void setSubtitleBgColor(int v)                { subtitleBgColor = v; _notify(); }

  void setAutoLoadLastProfile(bool v)           { autoLoadLastProfile = v; _notify(); }
  void setRememberLayout(bool v)                { rememberLayout = v; _notify(); }

  void setLayoutWidths({double? category, double? video, bool forceWrite = false}) {
    if (!rememberLayout && !forceWrite) return;
    if (category != null) categoryWidth = category.clamp(0, 480);
    if (video != null)    videoWidth    = video.clamp(0, 600);
    if (rememberLayout) {
      _notify(); // persist
    } else {
      notifyListeners(); // update UI only, no persist
    }
  }

  void resetLayout() {
    categoryWidth = _defaultCategoryWidth;
    videoWidth    = _defaultVideoWidth;
    notifyListeners(); // no _save — don't persist the reset
  }

  void setLastProfile(String username, String uuid) {
    lastProfileUsername = username;
    lastProfileUUID = uuid;
    _notify();
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  void addKeyToShortcut(ShortcutAction action, String key) {
    final updated = Map<ShortcutAction, List<String>>.from(keyboardShortcuts);

    // Remove key from any other action
    for (final a in ShortcutAction.values) {
      if (a != action && updated[a]!.contains(key)) {
        updated[a] = updated[a]!.where((k) => k != key).toList();
      }
    }

    final current = List<String>.from(updated[action] ?? []);
    if (!current.contains(key)) {
      if (current.length >= 2) {
        current[1] = key;
      } else {
        current.add(key);
      }
    }
    updated[action] = current;
    keyboardShortcuts = updated;
    _notify();
  }

  void removeKeyFromShortcut(ShortcutAction action, String key) {
    final updated = Map<ShortcutAction, List<String>>.from(keyboardShortcuts);
    updated[action] = updated[action]!.where((k) => k != key).toList();
    keyboardShortcuts = updated;
    _notify();
  }

  void resetKeyboardShortcuts() {
    keyboardShortcuts = Map.from(defaultKeyboardShortcuts);
    _notify();
  }

  void resetSettings() {
    language                  = 'en';
    deviceName                = 'Zenith Device';
    defaultVolume             = 0.7;
    autoResume                = true;
    autoPlayNext              = true;
    preferredAudioLanguages    = [];
    preferredSubtitleLanguages = [];
    subtitleFontSize  = 24.0;
    subtitleBold      = false;
    subtitleTextAlign = 'center';
    subtitleTextColor = 0xffffffff;
    subtitleBgColor   = 0xaa000000;
    autoLoadLastProfile       = false;
    rememberLayout            = false;
    keyboardShortcuts         = Map.from(defaultKeyboardShortcuts);
    _notify();
  }

  void _notify() {
    notifyListeners();
    _save();
  }
}
