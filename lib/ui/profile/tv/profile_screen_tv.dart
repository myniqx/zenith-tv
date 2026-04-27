import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../core/tv_focus.dart';
import '../../../stores/profile_store.dart';
import '../../../stores/content_store.dart';
import '../shared/profile_helpers.dart';
import 'profile_card_tv.dart';
import 'add_profile_form_tv.dart';

class ProfileScreenTv extends StatefulWidget {
  const ProfileScreenTv({super.key});

  @override
  State<ProfileScreenTv> createState() => _ProfileScreenTvState();
}

class _ProfileScreenTvState extends State<ProfileScreenTv> {
  bool _showAddForm = false;

  Future<void> _loadProfile(BuildContext context, Profile profile) async {
    final contentStore = context.read<ContentStore>();
    final uuid = profile.m3uRefs.isNotEmpty ? profile.m3uRefs.first : null;
    if (uuid == null) return;
    await contentStore.setContent(profile.username, uuid);
  }

  Future<void> _deleteProfile(BuildContext context, Profile profile) async {
    final ok = await showDeleteDialog(context, '"${profile.username}" profilini silmek istiyor musunuz?');
    if (ok != true) return;
    if (!context.mounted) return;
    await context.read<ProfileStore>().deleteProfile(profile.username);
  }

  Future<void> _createProfile(BuildContext context, String username, String url) async {
    final profileStore = context.read<ProfileStore>();
    final contentStore = context.read<ContentStore>();
    profileStore.createProfile(username);
    final uuid = profileStore.addM3UToProfile(username, url);
    await contentStore.setContent(username, uuid);
    if (mounted) setState(() => _showAddForm = false);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer2<ProfileStore, ContentStore>(
      builder: (context, profileStore, contentStore, _) {
        final sorted = [...profileStore.profiles]
          ..sort((a, b) => b.lastLogin.compareTo(a.lastLogin));

        return Stack(
          children: [
            // ── Ana içerik ──────────────────────────────────────────────────
            TvFocusScope(
              child: TvVerticalList(
                padding: const EdgeInsets.symmetric(horizontal: 80, vertical: 48),
                children: [
                  // Başlık
                  Text('Profil Yönetimi', style: ZText.headline(28)),
                  const SizedBox(height: 4),
                  Text(
                    'Profillerinizi ve M3U kaynaklarınızı yönetin',
                    style: ZText.body(15, color: ZColors.mutedForeground),
                  ),
                  const SizedBox(height: 32),

                  // Boş durum
                  if (sorted.isEmpty)
                    EmptyProfilesView(onAdd: () => setState(() => _showAddForm = true)),

                  // Profil kartları
                  ...sorted.map((p) => ProfileCardTv(
                    profile: p,
                    isActive: contentStore.currentUsername == p.username,
                    onLoad: () => _loadProfile(context, p),
                    onDelete: () => _deleteProfile(context, p),
                  )),

                  // Yeni profil butonu
                  if (sorted.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    TvFocusable(
                      onSelect: () => setState(() => _showAddForm = true),
                      builder: (context, focused) => Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 18),
                        decoration: BoxDecoration(
                          color: focused ? ZColors.primary.withValues(alpha: 0.08) : Colors.transparent,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: focused
                                ? ZColors.primary.withValues(alpha: 0.5)
                                : ZColors.border.withValues(alpha: 0.2),
                            style: BorderStyle.solid,
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.add_rounded, size: 20,
                                color: focused ? ZColors.primary : ZColors.mutedForeground),
                            const SizedBox(width: 8),
                            Text('Yeni Profil',
                                style: ZText.body(15, weight: FontWeight.w600,
                                    color: focused ? ZColors.primary : ZColors.mutedForeground)),
                          ],
                        ),
                      ),
                    ),
                  ],

                  const SizedBox(height: 48),
                ],
              ),
            ),

            // ── Add profile overlay — Tizen gibi fullscreen modal ──────────
            if (_showAddForm)
              Container(
                color: Colors.black.withValues(alpha: 0.75),
                child: AddProfileFormTv(
                  onSubmit: (username, url) => _createProfile(context, username, url),
                  onCancel: () => setState(() => _showAddForm = false),
                ),
              ),
          ],
        );
      },
    );
  }
}
