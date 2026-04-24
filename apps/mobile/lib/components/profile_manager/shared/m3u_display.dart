import '../../../../stores/profile_store.dart';

String m3uDisplayName(ProfileStore store, String uuid) {
  final url = store.getUrlFromUUID(uuid);
  if (url == null) return uuid.substring(0, 8);
  try {
    final uri = Uri.parse(url);
    final seg = uri.pathSegments.lastWhere((s) => s.isNotEmpty, orElse: () => uri.host);
    return seg.length > 40 ? '${seg.substring(0, 40)}…' : seg;
  } catch (_) {
    return url.length > 40 ? '${url.substring(0, 40)}…' : url;
  }
}
