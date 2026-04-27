/// Turkish-aware fuzzy string matcher.
/// Mirrors: shared/content/src/utils/string-matcher.ts → exString
class StringMatcher {
  static const _charMap = {
    'ş': 's',
    'ç': 'c',
    'ı': 'i',
    'ğ': 'g',
    'ü': 'u',
    'ö': 'o',
  };

  static String _normalize(String c) => _charMap[c] ?? c;

  /// Returns true if all [parts] appear in [name] in order (case-insensitive,
  /// Turkish char normalized).
  static bool hasMatch(List<String> parts, String name) {
    final lower = name.toLowerCase();
    var start = 0;
    final end =
        lower.length - parts.fold(0, (sum, p) => sum + p.length);

    for (final part in parts) {
      var paramFound = false;

      for (var i = start; i <= end; i++) {
        var found = true;

        for (var j = 0; j < part.length; j++) {
          final cA = _normalize(lower[i + j]);
          final cB = _normalize(part[j]);
          if (cA != cB) {
            found = false;
            break;
          }
        }

        if (found) {
          start = i + part.length;
          paramFound = true;
          break;
        }
      }

      if (!paramFound) return false;
    }

    return true;
  }
}
