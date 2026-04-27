import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';
import '../../../stores/profile_store.dart';

// M3U URL'ini görüntülenebilir kısa isme çevirir
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

// Profil silme onay dialog'u
Future<bool?> showDeleteDialog(BuildContext context, String message) {
  return showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Are you sure?'),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text('Cancel', style: ZText.body(14, color: ZColors.mutedForeground)),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          style: TextButton.styleFrom(foregroundColor: ZColors.destructiveFg),
          child: const Text('Delete'),
        ),
      ],
    ),
  );
}

// Profil avatar widget — her iki layout da kullanır
class ProfileAvatar extends StatelessWidget {
  final bool isActive;
  final double size;

  const ProfileAvatar({super.key, this.isActive = false, this.size = 48});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: isActive ? ZColors.primary.withValues(alpha: 0.2) : ZColors.muted,
        shape: BoxShape.circle,
      ),
      child: Icon(
        Icons.person_outline,
        size: size * 0.45,
        color: isActive ? ZColors.primary : ZColors.mutedForeground,
      ),
    );
  }
}

// Active badge
class ActiveBadge extends StatelessWidget {
  const ActiveBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: ZColors.primary.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        'AKTİF',
        style: ZText.body(10, weight: FontWeight.w800, color: ZColors.primary),
      ),
    );
  }
}

// Empty profiles state
class EmptyProfilesView extends StatelessWidget {
  final VoidCallback onAdd;
  const EmptyProfilesView({super.key, required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Column(
          children: [
            const Icon(Icons.person_outline, size: 64, color: ZColors.border),
            const SizedBox(height: 16),
            Text('Henüz profil yok', style: ZText.body(16, color: ZColors.mutedForeground)),
            const SizedBox(height: 8),
            Text(
              'Bir profil oluşturun ve M3U kaynağı ekleyin.',
              textAlign: TextAlign.center,
              style: ZText.body(13, color: ZColors.mutedForeground),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add),
              label: const Text('Profil Oluştur'),
            ),
          ],
        ),
      ),
    );
  }
}
