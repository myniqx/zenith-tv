import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/profile_store.dart';
import '../../../stores/content_store.dart';
import '../shared/profile_helpers.dart';

class ProfileScreenPhone extends StatefulWidget {
  final ProfileStore profileStore;
  final ContentStore contentStore;

  const ProfileScreenPhone({
    super.key,
    required this.profileStore,
    required this.contentStore,
  });

  @override
  State<ProfileScreenPhone> createState() => _ProfileScreenPhoneState();
}

class _ProfileScreenPhoneState extends State<ProfileScreenPhone> {
  String? _expandedUsername;
  bool _showAddProfile = false;
  final _usernameCtrl = TextEditingController();
  final _m3uUrlCtrl = TextEditingController();
  String? _addM3UForUsername;
  final _addM3UCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _expandedUsername = widget.contentStore.currentUsername ??
        (widget.profileStore.profiles.isNotEmpty
            ? widget.profileStore.profiles.first.username
            : null);
  }

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _m3uUrlCtrl.dispose();
    _addM3UCtrl.dispose();
    super.dispose();
  }

  Future<void> _createProfile() async {
    final username = _usernameCtrl.text.trim();
    final url = _m3uUrlCtrl.text.trim();
    if (username.isEmpty || url.isEmpty) return;
    try {
      widget.profileStore.createProfile(username);
      final uuid = widget.profileStore.addM3UToProfile(username, url);
      await context.read<ContentStore>().setContent(username, uuid);
      _usernameCtrl.clear();
      _m3uUrlCtrl.clear();
      if (mounted) setState(() { _showAddProfile = false; _expandedUsername = username; });
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Hata: $e')));
    }
  }

  Future<void> _addM3U(String username) async {
    final url = _addM3UCtrl.text.trim();
    if (url.isEmpty) return;
    try {
      widget.profileStore.addM3UToProfile(username, url);
      _addM3UCtrl.clear();
      setState(() => _addM3UForUsername = null);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Hata: $e')));
    }
  }

  Future<void> _deleteProfile(String username) async {
    final ok = await showDeleteDialog(context, '"$username" profilini silmek istiyor musunuz?');
    if (ok != true) return;
    await widget.profileStore.deleteProfile(username);
    if (_expandedUsername == username) setState(() => _expandedUsername = null);
  }

  Future<void> _removeM3U(String username, String uuid) async {
    final ok = await showDeleteDialog(context, 'Bu M3U kaynağını kaldırmak istiyor musunuz?');
    if (ok != true) return;
    await widget.profileStore.removeM3UFromProfile(username, uuid);
  }

  @override
  Widget build(BuildContext context) {
    final sorted = [...widget.profileStore.profiles]
      ..sort((a, b) => b.lastLogin.compareTo(a.lastLogin));

    return Scaffold(
      backgroundColor: ZColors.background,
      appBar: AppBar(title: const Text('Profiller')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (sorted.isEmpty && !_showAddProfile)
              EmptyProfilesView(onAdd: () => setState(() => _showAddProfile = true)),

            ...sorted.map((p) => _PhoneProfileCard(
              profile: p,
              isExpanded: _expandedUsername == p.username,
              isActive: widget.contentStore.currentUsername == p.username,
              activeUUID: widget.contentStore.currentUUID,
              profileStore: widget.profileStore,
              contentStore: widget.contentStore,
              addM3UForUsername: _addM3UForUsername,
              addM3UCtrl: _addM3UCtrl,
              onToggleExpand: () {
                if (p.m3uRefs.length == 1) {
                  context.read<ContentStore>().setContent(p.username, p.m3uRefs.first);
                } else {
                  setState(() {
                    _expandedUsername = _expandedUsername == p.username ? null : p.username;
                  });
                }
              },
              onActivate: (uuid) => context.read<ContentStore>().setContent(p.username, uuid),
              onDeleteProfile: () => _deleteProfile(p.username),
              onRemoveM3U: (uuid) => _removeM3U(p.username, uuid),
              onShowAddM3U: () => setState(() { _addM3UForUsername = p.username; _addM3UCtrl.clear(); }),
              onSubmitAddM3U: () => _addM3U(p.username),
              onCancelAddM3U: () => setState(() => _addM3UForUsername = null),
            )),

            const SizedBox(height: 12),

            if (_showAddProfile)
              _PhoneAddProfileForm(
                usernameCtrl: _usernameCtrl,
                m3uUrlCtrl: _m3uUrlCtrl,
                onSubmit: _createProfile,
                onCancel: () {
                  _usernameCtrl.clear();
                  _m3uUrlCtrl.clear();
                  setState(() => _showAddProfile = false);
                },
              )
            else if (sorted.isNotEmpty)
              _PhoneAddButton(
                label: 'Profil Ekle',
                onTap: () => setState(() => _showAddProfile = true),
              ),
          ],
        ),
      ),
    );
  }
}

class _PhoneProfileCard extends StatelessWidget {
  final Profile profile;
  final bool isExpanded;
  final bool isActive;
  final String? activeUUID;
  final ProfileStore profileStore;
  final ContentStore contentStore;
  final String? addM3UForUsername;
  final TextEditingController addM3UCtrl;
  final VoidCallback onToggleExpand;
  final Future<void> Function(String) onActivate;
  final VoidCallback onDeleteProfile;
  final Future<void> Function(String) onRemoveM3U;
  final VoidCallback onShowAddM3U;
  final VoidCallback onSubmitAddM3U;
  final VoidCallback onCancelAddM3U;

  const _PhoneProfileCard({
    required this.profile, required this.isExpanded, required this.isActive,
    required this.activeUUID, required this.profileStore, required this.contentStore,
    required this.addM3UForUsername, required this.addM3UCtrl,
    required this.onToggleExpand, required this.onActivate,
    required this.onDeleteProfile, required this.onRemoveM3U,
    required this.onShowAddM3U, required this.onSubmitAddM3U, required this.onCancelAddM3U,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(12),
        border: isActive
            ? Border.all(color: ZColors.primary.withValues(alpha: 0.5), width: 1.5)
            : Border.all(color: ZColors.border.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: onToggleExpand,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  ProfileAvatar(isActive: isActive, size: 36),
                  const SizedBox(width: 12),
                  Expanded(child: Text(profile.username, style: ZText.body(15, weight: FontWeight.w600))),
                  if (isActive) ...[const ActiveBadge(), const SizedBox(width: 8)],
                  Text('${profile.m3uRefs.length} kaynak', style: ZText.bodySm),
                  const SizedBox(width: 8),
                  Icon(isExpanded ? Icons.expand_less : Icons.expand_more, color: ZColors.mutedForeground),
                ],
              ),
            ),
          ),
          if (isExpanded) ...[
            Container(height: 1, color: ZColors.border.withValues(alpha: 0.2)),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  if (profile.m3uRefs.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Text('M3U kaynağı yok.', textAlign: TextAlign.center,
                          style: ZText.body(13, color: ZColors.mutedForeground)),
                    )
                  else
                    ...profile.m3uRefs.map((uuid) => _PhoneM3UTile(
                      uuid: uuid,
                      isActiveSource: isActive && activeUUID == uuid,
                      profileStore: profileStore,
                      contentStore: contentStore,
                      onActivate: () => onActivate(uuid),
                      onRemove: () => onRemoveM3U(uuid),
                    )),
                  if (addM3UForUsername == profile.username)
                    _PhoneInlineM3UForm(
                      ctrl: addM3UCtrl,
                      onSubmit: onSubmitAddM3U,
                      onCancel: onCancelAddM3U,
                    )
                  else
                    _PhoneAddButton(label: 'M3U Kaynağı Ekle', icon: Icons.add, onTap: onShowAddM3U, compact: true),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: TextButton.icon(
                      onPressed: onDeleteProfile,
                      icon: const Icon(Icons.delete_outline, color: ZColors.destructiveFg, size: 16),
                      label: Text('Profili Sil', style: ZText.body(13, color: ZColors.destructiveFg)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PhoneM3UTile extends StatelessWidget {
  final String uuid;
  final bool isActiveSource;
  final ProfileStore profileStore;
  final ContentStore contentStore;
  final VoidCallback onActivate;
  final VoidCallback onRemove;

  const _PhoneM3UTile({
    required this.uuid, required this.isActiveSource,
    required this.profileStore, required this.contentStore,
    required this.onActivate, required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final name = m3uDisplayName(profileStore, uuid);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isActiveSource ? ZColors.accent : ZColors.muted,
        borderRadius: BorderRadius.circular(10),
        border: isActiveSource ? Border.all(color: ZColors.primary.withValues(alpha: 0.4)) : null,
      ),
      child: Row(
        children: [
          const Icon(Icons.playlist_play, color: ZColors.mutedForeground, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: ZText.body(13, weight: FontWeight.w500)),
                if (contentStore.isLoading && isActiveSource)
                  Text('Yükleniyor…', style: ZText.body(11, color: ZColors.primary))
                else if (isActiveSource)
                  Text('${contentStore.calculateStats().totalWatchables} kanal', style: ZText.bodySm),
              ],
            ),
          ),
          if (!isActiveSource)
            TextButton(
              onPressed: onActivate,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text('Etkinleştir'),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: ZColors.primary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('Aktif', style: ZText.body(11, weight: FontWeight.w700, color: ZColors.primary)),
            ),
          const SizedBox(width: 4),
          IconButton(
            onPressed: onRemove,
            icon: const Icon(Icons.close, size: 16),
            color: ZColors.mutedForeground,
            padding: const EdgeInsets.all(4),
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }
}

class _PhoneAddProfileForm extends StatelessWidget {
  final TextEditingController usernameCtrl;
  final TextEditingController m3uUrlCtrl;
  final VoidCallback onSubmit;
  final VoidCallback onCancel;

  const _PhoneAddProfileForm({
    required this.usernameCtrl, required this.m3uUrlCtrl,
    required this.onSubmit, required this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Yeni Profil', style: ZText.headlineSm),
          const SizedBox(height: 16),
          _PhoneField(controller: usernameCtrl, label: 'Kullanıcı Adı', hint: 'örn. john_doe'),
          const SizedBox(height: 12),
          _PhoneField(controller: m3uUrlCtrl, label: 'M3U URL',
              hint: 'https://example.com/playlist.m3u', keyboardType: TextInputType.url),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: ElevatedButton(onPressed: onSubmit, child: const Text('Oluştur'))),
              const SizedBox(width: 10),
              OutlinedButton(onPressed: onCancel, child: const Text('İptal')),
            ],
          ),
        ],
      ),
    );
  }
}

class _PhoneInlineM3UForm extends StatelessWidget {
  final TextEditingController ctrl;
  final VoidCallback onSubmit;
  final VoidCallback onCancel;

  const _PhoneInlineM3UForm({required this.ctrl, required this.onSubmit, required this.onCancel});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        children: [
          TextField(
            controller: ctrl,
            style: ZText.body(13),
            keyboardType: TextInputType.url,
            decoration: const InputDecoration(hintText: 'https://example.com/playlist.m3u'),
            onSubmitted: (_) => onSubmit(),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: ElevatedButton(onPressed: onSubmit, child: const Text('Ekle'))),
              const SizedBox(width: 8),
              OutlinedButton(onPressed: onCancel, child: const Text('İptal')),
            ],
          ),
        ],
      ),
    );
  }
}

class _PhoneField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final TextInputType keyboardType;

  const _PhoneField({
    required this.controller, required this.label, required this.hint,
    this.keyboardType = TextInputType.text,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: ZText.bodySm),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          style: ZText.body(14),
          keyboardType: keyboardType,
          decoration: InputDecoration(hintText: hint),
        ),
      ],
    );
  }
}

class _PhoneAddButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final bool compact;

  const _PhoneAddButton({
    required this.label, required this.onTap,
    this.icon = Icons.add, this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: compact ? 16 : 18),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          padding: EdgeInsets.symmetric(vertical: compact ? 10 : 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }
}
