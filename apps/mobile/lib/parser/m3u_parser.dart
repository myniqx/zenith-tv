import 'dart:isolate';
import '../models/m3u_object.dart';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Parses M3U content on a background isolate and returns [M3UObject] list.
Future<List<M3UObject>> parseM3UAsync(String source) {
  return Isolate.run(() => _M3UParser(source).parse());
}

// ---------------------------------------------------------------------------
// FSM states
// ---------------------------------------------------------------------------

enum _State {
  idle,        // waiting for #EXTINF or URL
  attrs,       // reading key="value" attributes after #EXTINF:duration
  title,       // reading title after the comma
  url,         // reading the stream URL line
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class _M3UParser {
  _M3UParser(this._src);

  final String _src;

  // Current item accumulators
  final StringBuffer _attrsBuf = StringBuffer();
  final StringBuffer _titleBuf = StringBuffer();
  final StringBuffer _urlBuf   = StringBuffer();

  List<M3UObject> parse() {
    final results = <M3UObject>[];
    var state = _State.idle;
    final len = _src.length;

    for (var i = 0; i < len; i++) {
      final c = _src.codeUnitAt(i);

      switch (state) {
        case _State.idle:
          // Look for #EXTINF: — consume until we find it or a plain URL line
          if (c == 0x23) { // '#'
            // Peek ahead for "EXTINF:"
            if (_matchAt(i, '#EXTINF:')) {
              i += 8; // skip "#EXTINF:"
              // Skip duration digits and any chars up to first space or comma
              while (i < len) {
                final cc = _src.codeUnitAt(i);
                if (cc == 0x2C) { // ','  — no attributes, go straight to title
                  i++;
                  state = _State.title;
                  break;
                }
                if (cc == 0x20 || cc == 0x09) { // space/tab → attributes follow
                  i++;
                  state = _State.attrs;
                  break;
                }
                i++;
              }
            } else {
              // Comment or #EXTM3U header — skip to end of line
              while (i < len && _src.codeUnitAt(i) != 0x0A) {
                i++;
              }
            }
          } else if (c != 0x0A && c != 0x0D) {
            // Non-empty, non-comment line without a preceding #EXTINF
            // Treat as bare URL (some malformed playlists omit #EXTINF)
            _urlBuf.writeCharCode(c);
            state = _State.url;
          }

        case _State.attrs:
          if (c == 0x2C) { // ','
            state = _State.title;
          } else if (c == 0x0A) {
            // Newline inside attrs — malformed, reset
            _resetBuffers();
            state = _State.idle;
          } else {
            _attrsBuf.writeCharCode(c);
          }

        case _State.title:
          if (c == 0x0A) {
            state = _State.url;
          } else if (c != 0x0D) {
            _titleBuf.writeCharCode(c);
          }

        case _State.url:
          if (c == 0x0A) {
            final url = _urlBuf.toString().trim();
            if (url.isNotEmpty && !url.startsWith('#')) {
              final item = _buildItem(url);
              if (item != null) results.add(item);
            }
            _resetBuffers();
            state = _State.idle;
          } else if (c != 0x0D) {
            _urlBuf.writeCharCode(c);
          }
      }
    }

    // Handle last line with no trailing newline
    if (state == _State.url) {
      final url = _urlBuf.toString().trim();
      if (url.isNotEmpty && !url.startsWith('#')) {
        final item = _buildItem(url);
        if (item != null) results.add(item);
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Attribute extraction  (key="value" pairs, no regex)
  // -------------------------------------------------------------------------

  String _extractAttr(String attrs, String key) {
    // Find key="  then read until closing "
    final needle = '$key="';
    final start = attrs.indexOf(needle);
    if (start == -1) return '';
    var i = start + needle.length;
    final buf = StringBuffer();
    while (i < attrs.length && attrs.codeUnitAt(i) != 0x22) {
      buf.writeCharCode(attrs.codeUnitAt(i));
      i++;
    }
    return buf.toString();
  }

  // -------------------------------------------------------------------------
  // Build M3UObject from accumulated buffers
  // -------------------------------------------------------------------------

  M3UObject? _buildItem(String url) {
    final attrs = _attrsBuf.toString();
    final rawTitle = _titleBuf.toString().trim();
    if (rawTitle.isEmpty && url.isEmpty) return null;

    final group = _extractAttr(attrs, 'group-title');
    final logo  = _extractAttr(attrs, 'tvg-logo');

    final categorized = _categorize(rawTitle, url);

    return M3UObject(
      title:    categorized.title,
      url:      url,
      group:    group,
      logo:     logo.isEmpty ? null : logo,
      category: categorized.category,
      year:     categorized.year,
      season:   categorized.season,
      episode:  categorized.episode,
    );
  }

  void _resetBuffers() {
    _attrsBuf.clear();
    _titleBuf.clear();
    _urlBuf.clear();
  }

  // -------------------------------------------------------------------------
  // Peek: check if source matches [needle] starting at [pos]
  // -------------------------------------------------------------------------

  bool _matchAt(int pos, String needle) {
    if (pos + needle.length > _src.length) return false;
    for (var j = 0; j < needle.length; j++) {
      if (_src.codeUnitAt(pos + j) != needle.codeUnitAt(j)) return false;
    }
    return true;
  }
}

// ---------------------------------------------------------------------------
// Categorizer
// ---------------------------------------------------------------------------

class _CategorizedItem {
  const _CategorizedItem({
    required this.title,
    required this.category,
    this.year,
    this.season,
    this.episode,
  });
  final String title;
  final M3UCategory category;
  final int? year;
  final int? season;
  final int? episode;
}

_CategorizedItem _categorize(String rawTitle, String url) {
  if (_isLiveStream(url)) {
    return _CategorizedItem(title: rawTitle, category: M3UCategory.liveStream);
  }

  final yearResult  = _extractYear(rawTitle);
  final workTitle   = yearResult?.cleaned ?? rawTitle;
  final year        = yearResult?.year;

  final epResult = _detectEpisode(workTitle);
  if (epResult != null) {
    return _CategorizedItem(
      title:    epResult.seriesName,
      category: M3UCategory.series,
      year:     year,
      season:   epResult.season,
      episode:  epResult.episode,
    );
  }

  return _CategorizedItem(
    title:    workTitle,
    category: M3UCategory.movie,
    year:     year,
  );
}

// ── Live stream detection ─────────────────────────────────────────────────────

bool _isLiveStream(String url) {
  final slash = url.lastIndexOf('/');
  if (slash == -1) return false;
  var filename = url.substring(slash + 1);
  final q = filename.indexOf('?');
  if (q != -1) filename = filename.substring(0, q);
  return !filename.contains('.');
}

// ── Year extraction (19xx / 20xx, optionally wrapped in () or []) ─────────────

class _YearResult {
  const _YearResult(this.year, this.cleaned);
  final int year;
  final String cleaned;
}

_YearResult? _extractYear(String title) {
  final len = title.length;
  for (var i = 0; i <= len - 4; i++) {
    final c0 = title.codeUnitAt(i);
    final c1 = title.codeUnitAt(i + 1);
    // Must start with '19' or '20'
    if (c0 != 0x31 && c0 != 0x32) continue;          // '1' or '2'
    if (c0 == 0x31 && c1 != 0x39) continue;           // '19'
    if (c0 == 0x32 && c1 != 0x30) continue;           // '20'
    final c2 = title.codeUnitAt(i + 2);
    final c3 = title.codeUnitAt(i + 3);
    if (c2 < 0x30 || c2 > 0x39) continue;
    if (c3 < 0x30 || c3 > 0x39) continue;
    // Ensure not part of a longer number
    if (i > 0 && _isDigit(title.codeUnitAt(i - 1))) continue;
    if (i + 4 < len && _isDigit(title.codeUnitAt(i + 4))) continue;

    final year = (c0 - 0x30) * 1000 + (c1 - 0x30) * 100 +
                 (c2 - 0x30) * 10   + (c3 - 0x30);

    // Determine removal range — include surrounding bracket/paren
    var removeStart = i;
    var removeEnd   = i + 4;
    if (removeStart > 0) {
      final prev = title.codeUnitAt(removeStart - 1);
      if (prev == 0x28 || prev == 0x5B) removeStart--; // '(' or '['
    }
    if (removeEnd < len) {
      final next = title.codeUnitAt(removeEnd);
      if (next == 0x29 || next == 0x5D) removeEnd++;   // ')' or ']'
    }

    final cleaned = _trimPunctuation(_collapseSpaces(
      title.substring(0, removeStart) + title.substring(removeEnd),
    ));
    return _YearResult(year, cleaned);
  }
  return null;
}

// ── Episode detection (S01E01 / 1x01 / Season X Episode Y / Ep N) ────────────

class _EpisodeResult {
  const _EpisodeResult(this.seriesName, this.season, this.episode);
  final String seriesName;
  final int season;
  final int episode;
}

_EpisodeResult? _detectEpisode(String title) {
  final len = title.length;

  for (var i = 0; i < len; i++) {
    final c = title.codeUnitAt(i);

    // ── S01E01 / S1E1 / S01 E03 (optional space between S and E) ───────────
    if (c == 0x53 || c == 0x73) { // 'S' or 's'
      // must be preceded by non-letter (start or space/dash/dot)
      if (i > 0) {
        final prev = title.codeUnitAt(i - 1);
        if (_isLetter(prev)) continue; // part of a word like "Series", skip
      }
      final s = _readDigits(title, i + 1, 2);
      if (s != null) {
        var j = i + 1 + s.digitCount;
        // skip optional single space between season and episode marker
        if (j < len && title.codeUnitAt(j) == 0x20) j++;
        if (j < len && (title.codeUnitAt(j) == 0x45 || title.codeUnitAt(j) == 0x65)) {
          final e = _readDigits(title, j + 1, 2);
          if (e != null) {
            return _EpisodeResult(_seriesName(title, i), s.value, e.value);
          }
        }
      }
    }

    // ── 1x01 / 1x1 ─────────────────────────────────────────────────────────
    if (_isDigit(c)) {
      final s = _readDigits(title, i, 2);
      if (s != null) {
        final afterS = i + s.digitCount;
        if (afterS < len && (title.codeUnitAt(afterS) == 0x78 || title.codeUnitAt(afterS) == 0x58)) { // 'x'
          final e = _readDigits(title, afterS + 1, 2);
          if (e != null) {
            return _EpisodeResult(_seriesName(title, i), s.value, e.value);
          }
        }
      }
    }

    // ── "Season N Episode N" ────────────────────────────────────────────────
    if ((c == 0x53 || c == 0x73) && _matchesWordCI(title, i, 'season')) {
      final afterSeason = i + 6;
      final s = _readDigitsSkipSpaces(title, afterSeason, 2);
      if (s != null) {
        final afterSNum = afterSeason + s.skipped + s.digitCount;
        if (_matchesWordAt(title, afterSNum, 'episode')) {
          final epWordStart = _skipSpaces(title, afterSNum);
          final e = _readDigitsSkipSpaces(title, epWordStart + 7, 2);
          if (e != null) {
            return _EpisodeResult(_seriesName(title, i), s.value, e.value);
          }
        }
      }
    }

    // ── "Episode N" / "Ep N" / "Ep. N" → season 1 ──────────────────────────
    if ((c == 0x45 || c == 0x65) && _matchesWordCI(title, i, 'ep')) {
      var j = i + 2;
      // optional "isode"
      if (j + 5 <= len && title.substring(j, j + 5).toLowerCase() == 'isode') {
        j += 5;
      }
      // optional '.'
      if (j < len && title.codeUnitAt(j) == 0x2E) j++;
      // skip spaces
      while (j < len && title.codeUnitAt(j) == 0x20) { j++; }
      final e = _readDigits(title, j, 2);
      if (e != null) {
        return _EpisodeResult(_seriesName(title, i), 1, e.value);
      }
    }
  }

  return null;
}

// ── Small helpers ─────────────────────────────────────────────────────────────

bool _isDigit(int c) => c >= 0x30 && c <= 0x39;

bool _isLetter(int c) =>
    (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A); // A-Z or a-z

/// Case-insensitive prefix match at [pos].
bool _matchesWordCI(String s, int pos, String word) {
  if (pos + word.length > s.length) return false;
  for (var j = 0; j < word.length; j++) {
    if (s.codeUnitAt(pos + j) | 0x20 != word.codeUnitAt(j) | 0x20) return false;
  }
  return true;
}

/// Returns index of first non-space at or after [pos].
int _skipSpaces(String s, int pos) {
  while (pos < s.length && s.codeUnitAt(pos) == 0x20) { pos++; }
  return pos;
}

class _Digits {
  const _Digits(this.value, this.digitCount, [this.skipped = 0]);
  final int value;
  final int digitCount;
  final int skipped; // spaces skipped before digits
}

/// Read up to [max] consecutive digits starting at [pos].
_Digits? _readDigits(String s, int pos, int max) {
  final len = s.length;
  if (pos >= len || !_isDigit(s.codeUnitAt(pos))) return null;
  var value = 0;
  var count = 0;
  while (pos + count < len && count < max && _isDigit(s.codeUnitAt(pos + count))) {
    value = value * 10 + (s.codeUnitAt(pos + count) - 0x30);
    count++;
  }
  return count > 0 ? _Digits(value, count) : null;
}

/// Skip spaces then read digits.
_Digits? _readDigitsSkipSpaces(String s, int pos, int max) {
  var j = pos;
  while (j < s.length && s.codeUnitAt(j) == 0x20) { j++; }
  final d = _readDigits(s, j, max);
  if (d == null) return null;
  return _Digits(d.value, d.digitCount, j - pos);
}

/// Everything before [pos], trimmed — used as series name.
String _seriesName(String title, int markerPos) {
  return _trimPunctuation(_collapseSpaces(title.substring(0, markerPos)));
}

bool _matchesWordAt(String s, int pos, String word) {
  var j = pos;
  while (j < s.length && s.codeUnitAt(j) == 0x20) { j++; }
  if (j + word.length > s.length) return false;
  return s.substring(j, j + word.length).toLowerCase() == word.toLowerCase();
}

/// Remove leading/trailing punctuation artifacts left after year extraction.
/// e.g. "Film - " → "Film",  "- Show" → "Show",  "Film |" → "Film"
String _trimPunctuation(String s) {
  const punct = {0x2D, 0x7C, 0xB7, 0x2E, 0x2C, 0x5F}; // - | · . , _
  var start = 0;
  var end = s.length;
  while (start < end && (s.codeUnitAt(start) == 0x20 || punct.contains(s.codeUnitAt(start)))) {
    start++;
  }
  while (end > start && (s.codeUnitAt(end - 1) == 0x20 || punct.contains(s.codeUnitAt(end - 1)))) {
    end--;
  }
  return s.substring(start, end);
}

String _collapseSpaces(String s) {
  final buf = StringBuffer();
  var prevSpace = false;
  for (var i = 0; i < s.length; i++) {
    final c = s.codeUnitAt(i);
    if (c == 0x20 || c == 0x09) {
      if (!prevSpace) buf.writeCharCode(0x20);
      prevSpace = true;
    } else {
      buf.writeCharCode(c);
      prevSpace = false;
    }
  }
  return buf.toString().trim();
}
