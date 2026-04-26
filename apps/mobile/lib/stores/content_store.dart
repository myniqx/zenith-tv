import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../models/index.dart';
import '../p2p/models/profile_sync_payload.dart';
import '../p2p/utils/merge_user_data.dart';
import '../parser/m3u_parser.dart';
import 'content_helpers.dart';
import 'profile_store.dart';

export 'content_helpers.dart';

// ---------------------------------------------------------------------------
// ContentStore
// Mirrors: shared/content/src/stores/content/index.ts → createContentStore
// ---------------------------------------------------------------------------

class ContentStore extends ChangeNotifier {
  final ProfileStore profileStore;

  // --- Content groups (mirrors desktop) ---
  GroupObject movieGroup = GroupObject('Movies');
  GroupObject tvShowGroup = GroupObject('TV Shows');
  GroupObject streamGroup = GroupObject('Live Streams');
  GroupObject recentGroup = GroupObject('Recent');
  GroupObject favoriteGroup = GroupObject('Favorites');
  GroupObject watchedGroup = GroupObject('Watched');

  // --- Navigation state ---
  GroupObject? currentGroup;
  String searchQuery = '';
  SortBy sortBy = SortBy.name;
  SortOrder sortOrder = SortOrder.asc;
  GroupBy groupBy = GroupBy.none;
  List<ContentGroupData> groupedContent = [];

  // --- Profile state ---
  String? currentUsername;
  String? currentUUID;
  String? currentM3UUrl;

  // --- UserData ---
  UserData _userData = UserData.empty;
  UserData get userData => _userData;

  // --- Status ---
  bool isLoading = false;
  String? error;

  /// True only after a user-triggered setContent() completes loading.
  /// Shell uses this to auto-navigate to content browser once, then clears it.
  bool justLoaded = false;

  // --- Load progress (0.0 → 1.0) ---
  double loadProgress = 0.0;
  Timer? _downloadProgressTimer;

  // --- Derived lists ---
  List<WatchableObject> get recentItems => recentGroup.watchables;
  List<WatchableObject> get favoriteItems => favoriteGroup.watchables;

  /// True when a profile is selected and content is loaded.
  bool get isReady =>
      currentUsername != null &&
      currentUUID != null &&
      (movieGroup.totalCount > 0 ||
          tvShowGroup.totalCount > 0 ||
          streamGroup.totalCount > 0);

  ContentStore({required this.profileStore});

  // ---------------------------------------------------------------------------
  // setContent — mirrors desktop setContent()
  // ---------------------------------------------------------------------------

  Future<void> setContent(String username, String uuid) async {
    if (username == currentUsername && uuid == currentUUID) return;

    _reset();
    currentUsername = username;
    currentUUID = uuid;
    currentM3UUrl = profileStore.getUrlFromUUID(uuid);
    profileStore.touchProfile(username);

    await _loadUserData();
    await load();
    // If no cached source exists, fetch from network automatically
    if (error != null) await update();
    debugPrint(
      '[ContentStore] setContent done — isReady=$isReady error=$error '
      'movies=${movieGroup.totalCount} tv=${tvShowGroup.totalCount} streams=${streamGroup.totalCount}',
    );
    if (isReady) {
      justLoaded = true;
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // load — mirrors desktop load()
  // ---------------------------------------------------------------------------

  Future<void> load({bool fromUpdate = false}) async {
    if (currentUsername == null || currentUUID == null) return;

    isLoading = true;
    error = null;
    notifyListeners();

    try {
      debugPrint('[ContentStore] Loading ${currentUsername!}/${currentUUID!}');

      final source = await _readFile(getM3USource(currentUUID!));
      final update = await _readJsonOrDefault(
        getM3UUpdate(currentUUID!),
        M3UUpdateData.fresh(),
        M3UUpdateData.fromJson,
      );

      if (source == null) {
        // TODO: source null ve url file: ile basliyorsa bu m3u kaynagini silmeyi teklif et kullaniciya
        if (!fromUpdate) {
          debugPrint('[ContentStore] No source for ${currentUUID!}');
          error = 'No source content found. Use refresh to download.';
        }
        return;
      }

      final m3uList = await parseM3UAsync(source);
      debugPrint('[ContentStore] Parsed ${m3uList.length} items');

      _buildGroups(m3uList, update);

      final stats = calculateStats();
      debugPrint(
        '[ContentStore] Stats: movies=${stats.movieCount} '
        'tvShows=${stats.tvShowCount} live=${stats.liveStreamCount}',
      );
      await _writeJson(getM3UStats(currentUUID!), stats.toJson());

      if (update.items.isEmpty) {
        await _writeJson(getM3UUpdate(currentUUID!), update.toJson());
      }
    } catch (e) {
      error = 'Failed to load content: $e';
      debugPrint('[ContentStore] load error: $e');
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // update — fetch from network, add only new items
  // Mirrors: desktop update()
  // ---------------------------------------------------------------------------

  Future<void> update() async {
    if (currentUsername == null || currentUUID == null) return;

    // Load existing content first so we can diff
    await load(fromUpdate: true);

    final url = currentM3UUrl ?? profileStore.getUrlFromUUID(currentUUID!);
    if (url == null) {
      error = 'No URL found for this profile';
      notifyListeners();
      return;
    }

    if (url.startsWith('file:')) {
      debugPrint(
        '[ContentStore] Skipping update — source is a local file: $url',
      );
      return;
    }

    isLoading = true;
    loadProgress = 0.0;
    error = null;
    notifyListeners();

    try {
      // Phase 1: Download (0.0 → 0.70 indeterminate, timer-driven)
      _startDownloadProgress();
      debugPrint('[ContentStore] Fetching from $url');
      final sw = Stopwatch()..start();

      final response = await HttpClient().getUrl(Uri.parse(url));
      final res = await response.close();
      final source = await res.transform(utf8.decoder).join();

      _stopDownloadProgress();
      loadProgress = 0.70;
      notifyListeners();
      debugPrint(
        '[ContentStore] Fetched ${source.length} chars in ${sw.elapsedMilliseconds}ms',
      );

      // Phase 2: Rust parse (0.70 → 0.80)
      sw.reset();
      final m3uList = await parseM3UAsync(source);
      loadProgress = 0.80;
      notifyListeners();
      debugPrint(
        '[ContentStore] Parsed ${m3uList.length} items in ${sw.elapsedMilliseconds}ms (Rust FFI)',
      );

      if (m3uList.isEmpty) {
        error = 'Fetched empty playlist';
        return;
      }

      // Save source
      await _writeFile(getM3USource(currentUUID!), source);

      // Load existing update data
      final update = await _readJsonOrDefault(
        getM3UUpdate(currentUUID!),
        M3UUpdateData.fresh(),
        M3UUpdateData.fromJson,
      );

      final now = DateTime.now().millisecondsSinceEpoch;
      // On first fetch update.items is empty — don't flood recent
      final isFirstFetch = update.items.isEmpty;

      // Add only new items
      void addIfNew(GroupObject group, M3UObject item) {
        if (group.has(item)) return;
        final watchable = group.addGroup(item.group).add(item);
        watchable.addedDate = DateTime.fromMillisecondsSinceEpoch(now);
        update.items[item.url] = M3UItemData(addedAt: now);
        if (!isFirstFetch) recentGroup.addWatchable(watchable);
      }

      // Phase 3: Tree build (0.80 → 1.0), tick every 10k items
      sw.reset();
      final total = m3uList.length;
      for (var i = 0; i < total; i++) {
        final item = m3uList[i];
        switch (item.category) {
          case M3UCategory.movie:
            addIfNew(movieGroup, item);
            break;
          case M3UCategory.series:
            addIfNew(tvShowGroup, item);
            break;
          case M3UCategory.liveStream:
            addIfNew(streamGroup, item);
            break;
        }
        if (i % 10000 == 9999) {
          loadProgress = 0.80 + 0.20 * ((i + 1) / total);
          notifyListeners();
        }
      }

      movieGroup.lastCheck();
      tvShowGroup.lastCheck();
      streamGroup.lastCheck();
      recentGroup.lastCheck();
      debugPrint('[ContentStore] Tree built in ${sw.elapsedMilliseconds}ms');

      final stats = calculateStats();
      await _writeJson(getM3UUpdate(currentUUID!), update.toJson());
      await _writeJson(getM3UStats(currentUUID!), stats.toJson());

      debugPrint('[ContentStore] Update complete');
    } catch (e) {
      error = 'Failed to update: $e';
      debugPrint('[ContentStore] update error: $e');
    } finally {
      _stopDownloadProgress();
      loadProgress = 1.0;
      isLoading = false;
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  void setGroup(GroupObject? group) {
    if (currentGroup == group) return;
    currentGroup = group;
    _updateGroupedContent();
    notifyListeners();
  }

  void setSearchQuery(String query) {
    if (searchQuery == query) return;
    searchQuery = query;
    _updateGroupedContent();
    notifyListeners();
  }

  void setSortBy(SortBy value) {
    if (sortBy == value) return;
    sortBy = value;
    _updateGroupedContent();
    _savePlayerData();
    notifyListeners();
  }

  void setSortOrder(SortOrder value) {
    if (sortOrder == value) return;
    sortOrder = value;
    _updateGroupedContent();
    _savePlayerData();
    notifyListeners();
  }

  void setGroupBy(GroupBy value) {
    if (groupBy == value) return;
    groupBy = value;
    _updateGroupedContent();
    _savePlayerData();
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // UserData mutations
  // ---------------------------------------------------------------------------

  void toggleFavorite(WatchableObject watchable) {
    final current = watchable.userData.favorite?.value ?? false;
    final now = DateTime.now().millisecondsSinceEpoch;
    watchable.userData = watchable.userData.copyWith(
      favorite: FavoriteData(value: !current, updatedAt: now),
    );
    _persistWatchable(watchable);

    if (!current) {
      favoriteGroup.addWatchable(watchable);
    } else {
      favoriteGroup.removeWatchable(watchable);
    }
    notifyListeners();
  }

  void toggleHidden(WatchableObject watchable) {
    final current = watchable.userData.hidden?.value ?? false;
    final now = DateTime.now().millisecondsSinceEpoch;
    watchable.userData = watchable.userData.copyWith(
      hidden: HiddenData(value: !current, updatedAt: now),
    );
    _persistWatchable(watchable);
    notifyListeners();
  }

  void saveWatchProgress(
    WatchableObject watchable,
    double position,
    double duration,
  ) {
    if (watchable.category == M3UCategory.liveStream) return;

    final progress = secondsToProgress(position, duration);
    final now = DateTime.now().millisecondsSinceEpoch;
    final isWatched = progress > 0.95;

    final prevWatched = watchable.userData.watchProgress?.watched;
    final wasWatched = prevWatched != null;

    if (wasWatched && progress == 0) return;

    watchable.userData = watchable.userData.copyWith(
      watchProgress: WatchProgressData(
        progress: isWatched ? 0 : progress,
        updatedAt: now,
        watched: wasWatched ? prevWatched : (isWatched ? now : null),
      ),
    );
    _persistWatchable(watchable);

    if (isWatched && !wasWatched) {
      watchedGroup.addWatchable(watchable);
    }
    notifyListeners();
  }

  void saveTrackSelection(
    WatchableObject watchable, {
    int? audioTrack,
    int? subtitleTrack,
  }) {
    final now = DateTime.now().millisecondsSinceEpoch;
    watchable.userData = watchable.userData.copyWith(
      tracks: TrackSelectionData(
        audio: audioTrack,
        subtitle: subtitleTrack,
        updatedAt: now,
      ),
    );
    _persistWatchable(watchable);
    notifyListeners();
  }

  /// Saves total duration for a watchable into the update file (profile-independent).
  /// No-op if duration is already known or item is a live stream.
  Future<void> saveDuration(WatchableObject watchable, int durationMs) async {
    if (currentUUID == null) return;
    if (watchable.category == M3UCategory.liveStream) return;
    if (watchable.durationMs != null) return;

    watchable.durationMs = durationMs;
    notifyListeners();

    final update = await _readJsonOrDefault(
      getM3UUpdate(currentUUID!),
      M3UUpdateData.fresh(),
      M3UUpdateData.fromJson,
    );
    final existing = update.items[watchable.url];
    update.items[watchable.url] = existing != null
        ? existing.copyWith(durationMs: durationMs)
        : M3UItemData(durationMs: durationMs);
    await _writeJson(getM3UUpdate(currentUUID!), update.toJson());
  }

  // ---------------------------------------------------------------------------
  // Episode navigation
  // ---------------------------------------------------------------------------

  WatchableObject? getNextEpisode(WatchableObject current) {
    if (current.category != M3UCategory.series) return null;
    final tv = current as TvShowWatchableObject;
    final season = tv.upperLevel as TvShowSeasonGroupObject?;
    if (season == null) return null;

    final next = season.getEpisode(tv.episode + 1);
    if (next != null) return next;

    final show = season.upperLevel as TvShowGroupObject?;
    return show?.getEpisode(season.season + 1, 1);
  }

  WatchableObject? getPreviousEpisode(WatchableObject current) {
    if (current.category != M3UCategory.series) return null;
    final tv = current as TvShowWatchableObject;
    final season = tv.upperLevel as TvShowSeasonGroupObject?;
    if (season == null) return null;

    if (tv.episode > 1) return season.getEpisode(tv.episode - 1);

    final show = season.upperLevel as TvShowGroupObject?;
    if (show == null || season.season <= 1) return null;
    final prevSeason = show.getSeason(season.season - 1);
    return prevSeason?.getEpisode(prevSeason.episodeCount);
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  M3UStats calculateStats() {
    int countGroups(GroupObject g) =>
        g.groups.length +
        g.groups.fold(0, (sum, sub) => sum + countGroups(sub));

    return M3UStats(
      groupCount:
          countGroups(movieGroup) +
          countGroups(tvShowGroup) +
          countGroups(streamGroup),
      tvShowCount: tvShowGroup.tvShowCount,
      tvShowEpisodeCount: tvShowGroup.tvShowEpisodeCount,
      liveStreamCount: streamGroup.totalCount,
      movieCount: movieGroup.totalCount,
      totalWatchables:
          movieGroup.totalCount +
          tvShowGroup.tvShowEpisodeCount +
          streamGroup.totalCount,
    );
  }

  /// Resolves a watchable by its stream URL.
  /// Used by the server-side mirror store to set currentItem from
  /// mediaInfo.url in incoming client_event messages.
  /// Searches Movie → Series → LiveStream order.
  WatchableObject? findByUrl(String url) {
    return movieGroup.findByUrl(url) ??
        tvShowGroup.findByUrl(url) ??
        streamGroup.findByUrl(url);
  }

  /// Merges remote userData into local (timestamp-based) and persists.
  /// Returns the merged userData as a JSON map to send back.
  Future<Map<String, dynamic>> mergeAndSaveUserData(
    Map<String, dynamic> remoteJson,
  ) async {
    final merged = mergeUserData(_userData.toJson(), remoteJson);
    _userData = UserData.fromJson(merged);
    await _saveUserData();
    notifyListeners();
    return merged;
  }

  // ---------------------------------------------------------------------------
  // P2P sync
  // ---------------------------------------------------------------------------

  /// Writes M3U data received from a P2P peer and reloads.
  Future<void> syncM3UData(
    String uuid,
    String source,
    Map<String, dynamic> update,
    Map<String, dynamic> stats,
  ) async {
    await _writeFile(getM3USource(uuid), source);
    await _writeJson(getM3UUpdate(uuid), update);
    await _writeJson(getM3UStats(uuid), stats);
    if (currentUUID == uuid) await load();
  }

  /// Payload sent to newly connected P2P client.
  /// Mirrors: desktop getWellComePayload()
  ProfileSyncPayload? getWelcomePayload() {
    if (currentUsername == null ||
        currentUUID == null ||
        currentM3UUrl == null) {
      return null;
    }
    return ProfileSyncPayload(
      profile: ProfileInfo(
        username: currentUsername!,
        uuid: currentUUID!,
        url: currentM3UUrl!,
      ),
      userData: _userData.toJson(),
    );
  }

  // ---------------------------------------------------------------------------
  // Internal — group building
  // ---------------------------------------------------------------------------

  void _buildGroups(List<M3UObject> m3uList, M3UUpdateData update) {
    final thirtyDaysAgo =
        DateTime.now().millisecondsSinceEpoch - 30 * 24 * 60 * 60 * 1000;
    for (final item in m3uList) {
      WatchableObject watchable;

      switch (item.category) {
        case M3UCategory.movie:
          watchable = movieGroup.addGroup(item.group).add(item);
          break;
        case M3UCategory.series:
          watchable = tvShowGroup.addGroup(item.group).addTvShow(item);
          break;
        case M3UCategory.liveStream:
          watchable = streamGroup.addGroup(item.group).add(item);
          break;
      }

      final itemData = update.items[item.url];
      final addedAt = itemData?.addedAt ?? update.createdAt;
      watchable.addedDate = DateTime.fromMillisecondsSinceEpoch(addedAt);
      watchable.durationMs = itemData?.durationMs;

      if (itemData?.addedAt != null && addedAt > thirtyDaysAgo) {
        recentGroup.addWatchable(watchable);
      }

      final userItem = _userData.watchables[item.url];
      if (userItem != null) {
        watchable.userData = userItem;
        if (userItem.favorite?.value == true) {
          favoriteGroup.addWatchable(watchable);
        }
        if (userItem.watchProgress?.watched != null) {
          watchedGroup.addWatchable(watchable);
        }
      }
    }

    movieGroup.lastCheck();
    tvShowGroup.lastCheck();
    streamGroup.lastCheck();
    recentGroup.lastCheck();
  }

  // ---------------------------------------------------------------------------
  // Internal — grouped content (mirrors desktop updateGroupedContent)
  // ---------------------------------------------------------------------------

  void _updateGroupedContent() {
    if (currentGroup == null) {
      groupedContent = [];
      return;
    }

    final isSearching = searchQuery.trim().isNotEmpty;
    final result = <ContentGroupData>[];

    List<GroupObject> getGroups() {
      if (isSearching) {
        final all = collectGroupsRecursive(currentGroup!);
        final q = searchQuery.toLowerCase();
        return all.where((g) => g.name.toLowerCase().contains(q)).toList();
      }
      return [...currentGroup!.groups];
    }

    List<WatchableObject> getWatchables() {
      if (isSearching) {
        return filterBySearch(
          collectWatchablesRecursive(currentGroup!),
          searchQuery,
        );
      }
      return [...currentGroup!.watchables];
    }

    switch (groupBy) {
      case GroupBy.none:
      case GroupBy.group:
        final groups = getGroups();
        if (groups.isNotEmpty) {
          result.add(
            ContentGroupData(
              title: 'Groups',
              items: sortItems(groups, sortBy, sortOrder),
              isGroups: true,
            ),
          );
        }
        final watchables = getWatchables();
        if (watchables.isNotEmpty) {
          result.add(
            ContentGroupData(
              title: currentGroup!.name,
              items: sortItems(watchables, sortBy, sortOrder),
              isGroups: false,
            ),
          );
        }
        break;

      case GroupBy.year:
        final yearGroups = getGroups();
        if (yearGroups.isNotEmpty) {
          result.add(ContentGroupData(
            title: 'Groups',
            items: sortItems(yearGroups, sortBy, sortOrder),
            isGroups: true,
          ));
        }
        final byYear = <String, List<WatchableObject>>{};
        for (final w in getWatchables()) {
          final key = w.year?.toString() ?? 'Unknown Year';
          byYear.putIfAbsent(key, () => []).add(w);
        }
        final years = byYear.keys.toList()
          ..sort((a, b) {
            if (a == 'Unknown Year') return 1;
            if (b == 'Unknown Year') return -1;
            return int.parse(b).compareTo(int.parse(a));
          });
        for (final year in years) {
          final items = byYear[year]!;
          if (items.isNotEmpty) {
            result.add(
              ContentGroupData(
                title: year,
                items: sortItems(items, sortBy, sortOrder),
                isGroups: false,
              ),
            );
          }
        }
        break;

      case GroupBy.alphabetic:
        final alphaGroups = getGroups();
        if (alphaGroups.isNotEmpty) {
          result.add(ContentGroupData(
            title: 'Groups',
            items: sortItems(alphaGroups, sortBy, sortOrder),
            isGroups: true,
          ));
        }
        final byLetter = <String, List<WatchableObject>>{};
        for (final w in getWatchables()) {
          final letter = getFirstLetter(w.name);
          byLetter.putIfAbsent(letter, () => []).add(w);
        }
        final letters = byLetter.keys.toList()
          ..sort((a, b) {
            final ia = kAlphabeticGroups.indexOf(a);
            final ib = kAlphabeticGroups.indexOf(b);
            return ia.compareTo(ib);
          });
        for (final letter in letters) {
          final items = byLetter[letter]!;
          if (items.isNotEmpty) {
            result.add(
              ContentGroupData(
                title: letter,
                items: sortItems(items, sortBy, sortOrder),
                isGroups: false,
              ),
            );
          }
        }
        break;
    }

    groupedContent = result;
  }

  // ---------------------------------------------------------------------------
  // Internal — reset
  // ---------------------------------------------------------------------------

  // Slowly advances loadProgress from current value toward 0.60
  // until _stopDownloadProgress() is called.
  void _startDownloadProgress() {
    _downloadProgressTimer?.cancel();
    _downloadProgressTimer = Timer.periodic(const Duration(milliseconds: 300), (
      _,
    ) {
      if (loadProgress < 0.60) {
        loadProgress = (loadProgress + 0.02).clamp(0.0, 0.60);
        notifyListeners();
      }
    });
  }

  void _stopDownloadProgress() {
    _downloadProgressTimer?.cancel();
    _downloadProgressTimer = null;
  }

  void _reset() {
    movieGroup = GroupObject('Movies');
    tvShowGroup = GroupObject('TV Shows');
    streamGroup = GroupObject('Live Streams');
    recentGroup = GroupObject('Recent');
    favoriteGroup = GroupObject('Favorites');
    watchedGroup = GroupObject('Watched');
    currentGroup = null;
    groupedContent = [];
    searchQuery = '';
    currentUsername = null;
    currentUUID = null;
    currentM3UUrl = null;
    _userData = UserData.empty;
    error = null;
  }

  void reset() {
    _reset();
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Internal — userData persistence
  // ---------------------------------------------------------------------------

  Future<void> _loadUserData() async {
    if (currentUsername == null) return;
    final raw = await _readFile(getUserDataPath(currentUsername!));
    if (raw == null) return;
    try {
      _userData = UserData.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      // Restore player preferences
      sortBy = _userData.playerData.sortBy;
      sortOrder = _userData.playerData.sortOrder;
      groupBy = _userData.playerData.groupBy;
    } catch (_) {
      _userData = UserData.empty;
    }
  }

  Future<void> _saveUserData() async {
    if (currentUsername == null) return;
    await _writeJson(getUserDataPath(currentUsername!), _userData.toJson());
  }

  void _persistWatchable(WatchableObject watchable) {
    final updated = Map<String, UserItemData>.from(_userData.watchables);
    updated[watchable.url] = watchable.userData;
    _userData = _userData.copyWith(watchables: updated);
    _saveUserData();
  }

  void _savePlayerData() {
    _userData = _userData.copyWith(
      playerData: PlayerData(
        sortBy: sortBy,
        sortOrder: sortOrder,
        groupBy: groupBy,
      ),
    );
    _saveUserData();
  }

  // ---------------------------------------------------------------------------
  // File system helpers (path_provider + dart:io)
  // ---------------------------------------------------------------------------

  Future<Directory> get _baseDir async {
    final dir = await getApplicationDocumentsDirectory();
    return dir;
  }

  Future<String> _resolvePath(String relative) async {
    final base = await _baseDir;
    return '${base.path}/$relative';
  }

  Future<String?> _readFile(String relative) async {
    try {
      final path = await _resolvePath(relative);
      final file = File(path);
      if (!file.existsSync()) return null;
      return file.readAsStringSync();
    } catch (_) {
      return null;
    }
  }

  Future<T> _readJsonOrDefault<T>(
    String relative,
    T defaultValue,
    T Function(Map<String, dynamic>) fromJson,
  ) async {
    final raw = await _readFile(relative);
    if (raw == null) return defaultValue;
    try {
      return fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return defaultValue;
    }
  }

  Future<void> _writeFile(String relative, String content) async {
    final path = await _resolvePath(relative);
    final file = File(path);
    await file.parent.create(recursive: true);
    await file.writeAsString(content);
  }

  Future<void> _writeJson(String relative, Map<String, dynamic> data) async {
    await _writeFile(relative, jsonEncode(data));
  }
}
