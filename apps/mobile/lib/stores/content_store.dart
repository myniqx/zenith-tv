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
  StatusMessage statusMessage = StatusMessage.idle;
  Timer? _downloadProgressTimer;

  bool get isLoading => statusMessage.isLoading;
  String? get error => statusMessage.isError ? statusMessage.message : null;
  double get loadProgress => statusMessage.percent ?? 0.0;

  /// True only after a user-triggered setContent() completes loading.
  bool justLoaded = false;

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
    if (statusMessage.isError) await update();
    debugPrint(
      '[ContentStore] setContent done — isReady=$isReady status=${statusMessage.status} '
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

  void _status(StatusMessage msg) {
    statusMessage = msg;
    notifyListeners();
  }

  Future<void> load({bool fromUpdate = false}) async {
    if (currentUsername == null || currentUUID == null) return;

    _status(const StatusMessage(status: StatusKind.loading, message: 'Loading M3U...', percent: 0));

    try {
      _status(const StatusMessage(status: StatusKind.loading, message: 'Reading file...', percent: 0.2));
      final source = await _readFile(getM3USource(currentUUID!));
      final update = await _readJsonOrDefault(
        getM3UUpdate(currentUUID!),
        M3UUpdateData.fresh(),
        M3UUpdateData.fromJson,
      );

      if (source == null) {
        if (!fromUpdate) {
          _status(const StatusMessage(
            status: StatusKind.error,
            message: 'M3U not synced yet. Use the sync button to download.',
          ));
        }
        return;
      }

      _status(const StatusMessage(status: StatusKind.loading, message: 'Parsing M3U...', percent: 0.4));
      final sw = Stopwatch()..start();
      final m3uList = await parseM3UAsync(source);
      _status(StatusMessage(
        status: StatusKind.loading,
        message: 'Parsed in ${sw.elapsedMilliseconds}ms — building content...',
        percent: 0.55,
      ));

      _buildGroups(m3uList, update);

      final stats = calculateStats();
      await _writeJson(getM3UStats(currentUUID!), stats.toJson());
      if (update.items.isEmpty) {
        await _writeJson(getM3UUpdate(currentUUID!), update.toJson());
      }

      _status(StatusMessage(
        status: StatusKind.ready,
        message: 'Loaded in ${sw.elapsedMilliseconds}ms',
        percent: 1.0,
      ));
    } catch (e) {
      debugPrint('[ContentStore] load error: $e');
      _status(StatusMessage(status: StatusKind.error, message: 'Failed to load content: $e'));
    } finally {
      _updateGroupedContent();
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // update — fetch from network, add only new items
  // Mirrors: desktop update()
  // ---------------------------------------------------------------------------

  Future<void> update() async {
    if (currentUsername == null || currentUUID == null) return;

    await load(fromUpdate: true);

    final url = currentM3UUrl ?? profileStore.getUrlFromUUID(currentUUID!);
    if (url == null) {
      _status(const StatusMessage(status: StatusKind.error, message: 'No URL found for this profile'));
      return;
    }

    if (url.startsWith('file:')) return;

    final startedAt = DateTime.now();

    try {
      // Phase 1: Download — fake ramp to 0.35
      _startDownloadProgress();
      _status(const StatusMessage(status: StatusKind.loading, message: 'Fetching M3U...', percent: 0));

      final response = await HttpClient().getUrl(Uri.parse(url));
      final res = await response.close();
      final source = await res.transform(utf8.decoder).join();

      _stopDownloadProgress();
      final fetchedKb = (source.length / 1024).toStringAsFixed(0);
      _status(StatusMessage(
        status: StatusKind.loading,
        message: 'Fetched ${fetchedKb}KB — parsing...',
        percent: 0.4,
      ));

      // Phase 2: Parse
      final sw = Stopwatch()..start();
      final m3uList = await parseM3UAsync(source);
      _status(StatusMessage(
        status: StatusKind.loading,
        message: 'Parsed in ${sw.elapsedMilliseconds}ms — building content...',
        percent: 0.55,
      ));

      if (m3uList.isEmpty) {
        _status(const StatusMessage(status: StatusKind.error, message: 'Fetched empty playlist'));
        return;
      }

      await _writeFile(getM3USource(currentUUID!), source);

      final update = await _readJsonOrDefault(
        getM3UUpdate(currentUUID!),
        M3UUpdateData.fresh(),
        M3UUpdateData.fromJson,
      );

      final now = DateTime.now().millisecondsSinceEpoch;
      final isFirstFetch = update.items.isEmpty;

      void addIfNew(GroupObject group, M3UObject item) {
        if (group.has(item)) return;
        final watchable = group.addGroup(item.group).add(item);
        watchable.addedDate = DateTime.fromMillisecondsSinceEpoch(now);
        update.items[item.url] = M3UItemData(addedAt: now);
        if (!isFirstFetch) recentGroup.addWatchable(watchable);
      }

      // Phase 3: Tree build
      final total = m3uList.length;
      for (var i = 0; i < total; i++) {
        final item = m3uList[i];
        switch (item.category) {
          case M3UCategory.movie:    addIfNew(movieGroup,   item); break;
          case M3UCategory.series:   addIfNew(tvShowGroup,  item); break;
          case M3UCategory.liveStream: addIfNew(streamGroup, item); break;
        }
        if (i % 10000 == 9999) {
          _status(StatusMessage(
            status: StatusKind.loading,
            message: 'Building content... (${i + 1}/$total)',
            percent: 0.55 + 0.45 * ((i + 1) / total),
          ));
        }
      }

      movieGroup.lastCheck();
      tvShowGroup.lastCheck();
      streamGroup.lastCheck();
      recentGroup.lastCheck();

      final stats = calculateStats();
      await _writeJson(getM3UUpdate(currentUUID!), update.toJson());
      await _writeJson(getM3UStats(currentUUID!), stats.toJson());

      final totalMs = DateTime.now().difference(startedAt).inMilliseconds;
      _status(StatusMessage(
        status: StatusKind.ready,
        message: 'Updated in ${totalMs}ms',
        percent: 1.0,
      ));
    } catch (e) {
      debugPrint('[ContentStore] update error: $e');
      _status(StatusMessage(status: StatusKind.error, message: 'Failed to update: $e'));
    } finally {
      _stopDownloadProgress();
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

    debugPrint('[WatchProgress] ${watchable.name} | pos=${position.toStringAsFixed(1)}s dur=${duration.toStringAsFixed(1)}s progress=${(progress * 100).toStringAsFixed(1)}% isWatched=$isWatched wasWatched=$wasWatched');

    if (wasWatched && progress == 0) {
      debugPrint('[WatchProgress] skip — already watched and progress=0');
      return;
    }

    watchable.userData = watchable.userData.copyWith(
      watchProgress: WatchProgressData(
        progress: isWatched ? 0 : progress,
        updatedAt: now,
        watched: wasWatched ? prevWatched : (isWatched ? now : null),
      ),
    );
    debugPrint('[WatchProgress] saved → progress=${isWatched ? 0 : (progress * 100).toStringAsFixed(1)}%');
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

  /// Returns M3U files for the current profile so a P2P peer can request a full sync.
  /// Returns null when no profile is active or source file does not exist yet.
  Future<M3UDataSync?> getM3UDataForSync() async {
    if (currentUUID == null || currentM3UUrl == null) return null;

    final source = await _readFile(getM3USource(currentUUID!));
    if (source == null) return null;

    final update = await _readJsonOrDefault(
      getM3UUpdate(currentUUID!),
      M3UUpdateData.fresh(),
      M3UUpdateData.fromJson,
    );
    final stats = await _readJsonOrDefault(
      getM3UStats(currentUUID!),
      <String, dynamic>{},
      (j) => j,
    );

    return M3UDataSync(
      source: currentM3UUrl!,
      update: update.toJson(),
      stats: stats,
    );
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
      final rootGroups = [
        movieGroup, tvShowGroup, streamGroup,
        recentGroup, favoriteGroup, watchedGroup,
      ].where((g) => g.totalCount > 0).toList();
      groupedContent = rootGroups.isEmpty ? [] : [
        ContentGroupData(
          title: 'Browse',
          items: rootGroups,
          isGroups: true,
        ),
      ];
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

  void _startDownloadProgress() {
    _downloadProgressTimer?.cancel();
    _downloadProgressTimer = Timer.periodic(const Duration(milliseconds: 300), (_) {
      final current = statusMessage.percent ?? 0.0;
      if (current < 0.35) {
        _status(StatusMessage(
          status: StatusKind.loading,
          message: statusMessage.message,
          percent: (current + 0.02).clamp(0.0, 0.35),
        ));
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
    statusMessage = StatusMessage.idle;
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
