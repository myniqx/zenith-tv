import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

/// A user profile with associated M3U source UUIDs.
/// Mirrors: apps/desktop/src/stores/profiles.ts → Profile
class Profile {
  final String username;
  final List<String> m3uRefs; // list of UUIDs
  final int createdAt;
  final int lastLogin;

  const Profile({
    required this.username,
    required this.m3uRefs,
    required this.createdAt,
    required this.lastLogin,
  });

  Profile copyWith({List<String>? m3uRefs, int? lastLogin}) {
    return Profile(
      username: username,
      m3uRefs: m3uRefs ?? this.m3uRefs,
      createdAt: createdAt,
      lastLogin: lastLogin ?? this.lastLogin,
    );
  }

  factory Profile.fromJson(Map<String, dynamic> json) => Profile(
        username: json['username'] as String,
        m3uRefs: List<String>.from(json['m3uRefs'] as List),
        createdAt: (json['createdAt'] as num).toInt(),
        lastLogin: (json['lastLogin'] as num).toInt(),
      );

  Map<String, dynamic> toJson() => {
        'username': username,
        'm3uRefs': m3uRefs,
        'createdAt': createdAt,
        'lastLogin': lastLogin,
      };
}

/// Manages user profiles and M3U URL → UUID mapping.
/// Mirrors: apps/desktop/src/stores/profiles.ts
class ProfileStore extends ChangeNotifier {
  static const String _prefsKey = 'zenith_profiles';
  static const _uuid = Uuid();

  List<Profile> _profiles = [];
  Map<String, String> _m3uMap = {}; // url → uuid

  List<Profile> get profiles => List.unmodifiable(_profiles);
  Map<String, String> get m3uMap => Map.unmodifiable(_m3uMap);

  bool get hasProfiles => _profiles.isNotEmpty;

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  Future<void> init() async {
    await _load();
  }

  // ---------------------------------------------------------------------------
  // UUID helpers
  // ---------------------------------------------------------------------------

  String? getUrlFromUUID(String uuid) {
    return _m3uMap.entries
        .where((e) => e.value == uuid)
        .map((e) => e.key)
        .firstOrNull;
  }

  String? getUUIDFromURL(String url) => _m3uMap[url];

  String getOrCreateUUID(String url) {
    if (_m3uMap.containsKey(url)) return _m3uMap[url]!;
    final id = _uuid.v4();
    _m3uMap[url] = id;
    return id;
  }

  bool isUUIDUsed(String uuid) =>
      _profiles.any((p) => p.m3uRefs.contains(uuid));

  // ---------------------------------------------------------------------------
  // Profile CRUD
  // ---------------------------------------------------------------------------

  /// Creates a new empty profile.
  void createProfile(String username) {
    if (_profiles.any((p) => p.username == username)) {
      throw StateError('Profile already exists: $username');
    }
    _profiles = [
      ..._profiles,
      Profile(
        username: username,
        m3uRefs: [],
        createdAt: DateTime.now().millisecondsSinceEpoch,
        lastLogin: DateTime.now().millisecondsSinceEpoch,
      ),
    ];
    _save();
    notifyListeners();
  }

  /// Deletes a profile and removes orphaned UUID mappings.
  Future<void> deleteProfile(String username) async {
    final profile = _profiles.where((p) => p.username == username).firstOrNull;
    if (profile == null) return;

    _profiles = _profiles.where((p) => p.username != username).toList();

    // Remove URL mappings that are no longer used
    for (final uuid in profile.m3uRefs) {
      if (!isUUIDUsed(uuid)) {
        _m3uMap.removeWhere((_, v) => v == uuid);
      }
    }

    await _save();
    notifyListeners();
  }

  /// Adds an M3U URL to a profile and returns its UUID.
  String addM3UToProfile(String username, String m3uUrl) {
    final uuid = getOrCreateUUID(m3uUrl);
    _profiles = _profiles.map((p) {
      if (p.username != username) return p;
      if (p.m3uRefs.contains(uuid)) return p;
      return p.copyWith(m3uRefs: [...p.m3uRefs, uuid]);
    }).toList();
    _save();
    notifyListeners();
    return uuid;
  }

  /// Removes an M3U UUID from a profile.
  Future<void> removeM3UFromProfile(String username, String uuid) async {
    _profiles = _profiles.map((p) {
      if (p.username != username) return p;
      return p.copyWith(m3uRefs: p.m3uRefs.where((r) => r != uuid).toList());
    }).toList();

    if (!isUUIDUsed(uuid)) {
      _m3uMap.removeWhere((_, v) => v == uuid);
    }

    await _save();
    notifyListeners();
  }

  /// Updates lastLogin for a profile.
  void touchProfile(String username) {
    _profiles = _profiles.map((p) {
      if (p.username != username) return p;
      return p.copyWith(lastLogin: DateTime.now().millisecondsSinceEpoch);
    }).toList();
    _save();
    notifyListeners();
  }

  Profile? getProfile(String username) =>
      _profiles.where((p) => p.username == username).firstOrNull;

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw == null) return;

    try {
      final data = jsonDecode(raw) as Map<String, dynamic>;
      _profiles = (data['profiles'] as List)
          .map((e) => Profile.fromJson(e as Map<String, dynamic>))
          .toList();
      _m3uMap = Map<String, String>.from(data['m3uMap'] as Map);
    } catch (_) {
      // Corrupt prefs — start fresh
    }
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _prefsKey,
      jsonEncode({
        'profiles': _profiles.map((p) => p.toJson()).toList(),
        'm3uMap': _m3uMap,
      }),
    );
  }
}
