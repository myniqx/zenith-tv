// TODO: Replace with Rust FFI parser (same native library used by desktop/tizen via WASM).
// Current implementation is a minimal pure-Dart fallback for development and testing.
// Rust FFI target: cargo-ndk → .so, dart:ffi bridge, same parser logic as core/parser.

import '../stores/content_store.dart';

/// Parses raw M3U text into a list of M3UItem.
/// Handles #EXTINF attributes: tvg-logo, group-title, tvg-name.
List<M3UItem> parseM3U(String content) {
  final items = <M3UItem>[];
  final lines = content.split('\n');

  String? title;
  String? group;
  String? logo;
  String? category;

  for (final raw in lines) {
    final line = raw.trim();
    if (line.isEmpty) continue;

    if (line.startsWith('#EXTINF')) {
      title = _attr(line, 'tvg-name') ?? _commaTitle(line);
      group = _attr(line, 'group-title');
      logo = _attr(line, 'tvg-logo');
      category = _detectCategory(group, title);
    } else if (!line.startsWith('#') && line.isNotEmpty) {
      if (title != null) {
        items.add(M3UItem(
          title: title,
          url: line,
          group: group ?? 'General',
          logo: logo,
          category: category ?? 'LiveStream',
        ));
      }
      title = null;
      group = null;
      logo = null;
      category = null;
    }
  }

  return items;
}

String? _attr(String line, String key) {
  final pattern = RegExp('$key="([^"]*)"');
  final match = pattern.firstMatch(line);
  return match?.group(1);
}

String? _commaTitle(String line) {
  final idx = line.lastIndexOf(',');
  if (idx < 0) return null;
  final t = line.substring(idx + 1).trim();
  return t.isEmpty ? null : t;
}

String _detectCategory(String? group, String? title) {
  final g = (group ?? '').toLowerCase();
  final t = (title ?? '').toLowerCase();
  if (g.contains('movie') || g.contains('film') || t.contains('(20') || t.contains('(19')) {
    return 'Movie';
  }
  if (g.contains('series') || g.contains('show') || g.contains('episode')) {
    return 'Series';
  }
  return 'LiveStream';
}
