import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'm3u_parser.dart';
import 'profile_store.dart';
import '../p2p/utils/merge_user_data.dart';

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

class M3UItem {
  final String title;
  final String url;
  final String group;
  final String? logo;
  final String category; // 'Movie' | 'Series' | 'LiveStream'

  const M3UItem({
    required this.title,
    required this.url,
    required this.group,
    required this.category,
    this.logo,
  });

  factory M3UItem.fromJson(Map<String, dynamic> json) => M3UItem(
        title: json['title'] as String,
        url: json['url'] as String,
        group: json['group'] as String,
        category: json['category'] as String,
        logo: json['logo'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'title': title,
        'url': url,
        'group': group,
        'category': category,
        if (logo != null) 'logo': logo,
      };
}

class M3UGroup {
  final String name;
  final String category;
  final List<M3UItem> items;

  const M3UGroup({
    required this.name,
    required this.category,
    required this.items,
  });
}

// ---------------------------------------------------------------------------
// ContentStore
// ---------------------------------------------------------------------------

/// Manages loaded M3U content and user data (favorites, watch progress, tracks).
/// Mirrors: shared/content/src/stores/content/index.ts → createContentStore
class ContentStore extends ChangeNotifier {
  static const String _userDataPrefsKey = 'zenith_user_data';

  final ProfileStore profileStore;

  // --- State ---
  String? _currentUsername;
  String? _currentUUID;
  List<M3UItem> _items = [];
  List<M3UGroup> _groups = [];
  Map<String, dynamic> _userData = _emptyUserData();
  bool _isLoading = false;
  String? _error;

  // --- Getters ---
  String? get currentUsername => _currentUsername;
  String? get currentUUID => _currentUUID;
  List<M3UItem> get items => List.unmodifiable(_items);
  List<M3UGroup> get groups => List.unmodifiable(_groups);
  Map<String, dynamic> get userData => Map.unmodifiable(_userData);
  bool get isLoading => _isLoading;
  String? get error => _error;

  /// True when a profile is selected and M3U is loaded.
  bool get isReady =>
      _currentUsername != null && _currentUUID != null && _items.isNotEmpty;

  List<M3UGroup> get movieGroups =>
      _groups.where((g) => g.category == 'Movie').toList();

  List<M3UGroup> get seriesGroups =>
      _groups.where((g) => g.category == 'Series').toList();

  List<M3UGroup> get liveGroups =>
      _groups.where((g) => g.category == 'LiveStream').toList();

  List<M3UItem> get favoriteItems {
    final watchables = _userData['watchables'] as Map<String, dynamic>? ?? {};
    return _items.where((item) {
      final d = watchables[item.url] as Map<String, dynamic>?;
      return (d?['favorite'] as Map<String, dynamic>?)?['value'] == true;
    }).toList();
  }

  ContentStore({required this.profileStore});

  // ---------------------------------------------------------------------------
  // Profile selection
  // ---------------------------------------------------------------------------

  /// Sets active profile and loads its M3U content.
  /// Mirrors: desktop content store setContent()
  Future<void> setContent(String username, String uuid) async {
    _currentUsername = username;
    _currentUUID = uuid;
    profileStore.touchProfile(username);
    await load();
  }

  /// Reloads M3U for current profile.
  Future<void> load() async {
    if (_currentUUID == null) return;

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Try cached file first
      final cached = await _readCachedM3U(_currentUUID!);

      if (cached != null) {
        _applyItems(parseM3U(cached));
      } else {
        // Fetch from network
        final url = profileStore.getUrlFromUUID(_currentUUID!);
        if (url == null) {
          _error = 'No URL found for UUID: $_currentUUID';
          return;
        }
        final content = await _fetchM3U(url);
        await _cacheM3U(_currentUUID!, content);
        _applyItems(parseM3U(content));
      }

      await _loadUserData();
    } catch (e) {
      _error = 'Failed to load content: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Resets content state (e.g. after profile deletion).
  void reset() {
    _currentUsername = null;
    _currentUUID = null;
    _items = [];
    _groups = [];
    _userData = _emptyUserData();
    _error = null;
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // UserData
  // ---------------------------------------------------------------------------

  Future<void> setUserData(Map<String, dynamic> data) async {
    _userData = data;
    await _saveUserData();
    notifyListeners();
  }

  /// Merges remote userData (from P2P) into local and persists.
  Future<Map<String, dynamic>> mergeAndSaveUserData(
      Map<String, dynamic> remote) async {
    final merged = mergeUserData(_userData, remote);
    await setUserData(merged);
    return merged;
  }

  void setFavorite(String url, bool value) {
    _mutateWatchable(url, 'favorite', {
      'value': value,
      'updatedAt': DateTime.now().millisecondsSinceEpoch,
    });
  }

  void setWatchProgress(String url, double progress, {bool? watched}) {
    _mutateWatchable(url, 'watchProgress', {
      'progress': progress,
      'updatedAt': DateTime.now().millisecondsSinceEpoch,
      'watched': watched == true ? DateTime.now().millisecondsSinceEpoch : null,
    });
  }

  void setTrackSelection(String url, {int? audio, int? subtitle}) {
    _mutateWatchable(url, 'tracks', {
      'audio': audio,
      'subtitle': subtitle,
      'updatedAt': DateTime.now().millisecondsSinceEpoch,
    });
  }

  Map<String, dynamic>? getItemData(String url) {
    final watchables = _userData['watchables'] as Map<String, dynamic>?;
    return watchables?[url] as Map<String, dynamic>?;
  }

  // ---------------------------------------------------------------------------
  // P2P sync
  // ---------------------------------------------------------------------------

  /// Writes M3U data received from a P2P peer.
  /// Mirrors: desktop P2PManager syncM3UData call
  Future<void> syncM3UData(
    String uuid,
    String source,
    Map<String, dynamic> update,
    Map<String, dynamic> stats,
  ) async {
    await _cacheM3URaw(uuid, update, stats);
    if (_currentUUID == uuid) {
      await load();
    }
  }

  /// Builds the welcome payload sent to a newly connected P2P client.
  /// Mirrors: desktop content store getWellComePayload()
  Map<String, dynamic>? getWelcomePayload() {
    if (_currentUsername == null || _currentUUID == null) return null;

    final profile = profileStore.getProfile(_currentUsername!);
    if (profile == null) return null;

    final url = profileStore.getUrlFromUUID(_currentUUID!);
    if (url == null) return null;

    return {
      'profile': {
        'username': _currentUsername,
        'uuid': _currentUUID,
        'url': url,
      },
      'userData': _userData,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  void _applyItems(List<M3UItem> items) {
    _items = items;
    _groups = _buildGroups(items);
  }

  List<M3UGroup> _buildGroups(List<M3UItem> items) {
    final map = <String, List<M3UItem>>{};
    for (final item in items) {
      map.putIfAbsent(item.group, () => []).add(item);
    }
    return map.entries.map((e) {
      final category = e.value.first.category;
      return M3UGroup(name: e.key, category: category, items: e.value);
    }).toList();
  }

  void _mutateWatchable(String url, String field, Map<String, dynamic> data) {
    final watchables =
        Map<String, dynamic>.from(_userData['watchables'] as Map? ?? {});
    final item =
        Map<String, dynamic>.from(watchables[url] as Map? ?? {});
    item[field] = data;
    watchables[url] = item;
    _userData = {..._userData, 'watchables': watchables};
    _saveUserData();
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // File cache
  // ---------------------------------------------------------------------------

  Future<Directory> _m3uDir(String uuid) async {
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory('${base.path}/m3u/$uuid');
    if (!dir.existsSync()) dir.createSync(recursive: true);
    return dir;
  }

  Future<String?> _readCachedM3U(String uuid) async {
    try {
      final dir = await _m3uDir(uuid);
      final file = File('${dir.path}/content.m3u');
      if (!file.existsSync()) return null;
      return file.readAsStringSync();
    } catch (_) {
      return null;
    }
  }

  Future<void> _cacheM3U(String uuid, String content) async {
    final dir = await _m3uDir(uuid);
    await File('${dir.path}/content.m3u').writeAsString(content);
  }

  Future<void> _cacheM3URaw(
    String uuid,
    Map<String, dynamic> update,
    Map<String, dynamic> stats,
  ) async {
    final dir = await _m3uDir(uuid);
    await File('${dir.path}/update.json')
        .writeAsString(jsonEncode(update));
    await File('${dir.path}/stats.json')
        .writeAsString(jsonEncode(stats));
  }

  // ---------------------------------------------------------------------------
  // Network
  // ---------------------------------------------------------------------------

  Future<String> _fetchM3U(String url) async {
    final uri = Uri.parse(url);
    final response = await http.get(uri).timeout(const Duration(seconds: 30));
    if (response.statusCode != 200) {
      throw Exception('HTTP ${response.statusCode}');
    }
    return response.body;
  }

  // ---------------------------------------------------------------------------
  // UserData persistence (SharedPreferences, keyed by uuid)
  // ---------------------------------------------------------------------------

  Future<void> _loadUserData() async {
    if (_currentUUID == null) return;
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('${_userDataPrefsKey}_$_currentUUID');
    if (raw == null) {
      _userData = _emptyUserData();
      return;
    }
    try {
      _userData = jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      _userData = _emptyUserData();
    }
  }

  Future<void> _saveUserData() async {
    if (_currentUUID == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      '${_userDataPrefsKey}_$_currentUUID',
      jsonEncode(_userData),
    );
  }

  static Map<String, dynamic> _emptyUserData() => {
        'watchables': <String, dynamic>{},
        'hiddenGroups': <String>[],
        'stickyGroups': <String>[],
        'playerData': null,
        'layoutData': null,
      };
}
