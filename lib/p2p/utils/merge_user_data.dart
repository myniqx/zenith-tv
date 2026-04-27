/// Merge two UserData maps using timestamps — remote wins when newer.
/// Mirrors: shared/content/src/utils/mergeUserData.ts
///
/// UserData structure (raw JSON map):
/// {
///   "watchables": { "url": { "favorite": {...}, "hidden": {...}, "watchProgress": {...}, "tracks": {...} } },
///   "hiddenGroups": [...],
///   "stickyGroups": [...],
///   "playerData": {...},
///   "layoutData": {...},
/// }
Map<String, dynamic> mergeUserData(
  Map<String, dynamic> local,
  Map<String, dynamic> remote,
) {
  final localWatchables =
      Map<String, dynamic>.from(local['watchables'] as Map? ?? {});
  final remoteWatchables =
      Map<String, dynamic>.from(remote['watchables'] as Map? ?? {});

  final allUrls = <String>{
    ...localWatchables.keys,
    ...remoteWatchables.keys,
  };

  for (final url in allUrls) {
    final localItem = localWatchables[url] as Map<String, dynamic>?;
    final remoteItem = remoteWatchables[url] as Map<String, dynamic>?;

    if (localItem == null) {
      localWatchables[url] = Map<String, dynamic>.from(remoteItem!);
      continue;
    }

    if (remoteItem == null) continue;

    _mergeTimestampedField(localItem, remoteItem, 'favorite');
    _mergeTimestampedField(localItem, remoteItem, 'hidden');
    _mergeTimestampedField(localItem, remoteItem, 'watchProgress');
    _mergeTimestampedField(localItem, remoteItem, 'tracks');
  }

  final localHidden = _toStringList(local['hiddenGroups']);
  final remoteHidden = _toStringList(remote['hiddenGroups']);
  final localSticky = _toStringList(local['stickyGroups']);
  final remoteSticky = _toStringList(remote['stickyGroups']);

  return {
    'watchables': localWatchables,
    'hiddenGroups': {...localHidden, ...remoteHidden}.toList(),
    'stickyGroups': {...localSticky, ...remoteSticky}.toList(),
    'playerData': local['playerData'],
    'layoutData': local['layoutData'],
  };
}

void _mergeTimestampedField(
  Map<String, dynamic> local,
  Map<String, dynamic> remote,
  String field,
) {
  final remoteField = remote[field] as Map<String, dynamic>?;
  if (remoteField == null) return;

  final localField = local[field] as Map<String, dynamic>?;
  final localTime = (localField?['updatedAt'] as num?)?.toInt() ?? 0;
  final remoteTime = (remoteField['updatedAt'] as num?)?.toInt() ?? 0;

  if (remoteTime > localTime) {
    local[field] = remoteField;
  }
}

List<String> _toStringList(dynamic value) {
  if (value == null) return [];
  return (value as List).map((e) => e.toString()).toList();
}
