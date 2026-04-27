import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/profile_store.dart';
import '../../../stores/content_store.dart';
import '../shared/content_status_bar.dart';
import '../shared/delete_dialog.dart';
import '../shared/m3u_display.dart';
import '../shared/profile_avatar.dart';

class ProfileManagerPhone extends StatefulWidget {
  final VoidCallback? onLoaded;

  const ProfileManagerPhone({super.key, this.onLoaded});

  @override
  State<ProfileManagerPhone> createState() => _ProfileManagerPhoneState();
}

class _ProfileManagerPhoneState extends State<ProfileManagerPhone> {
  String? _expandedUsername;
  bool _showAddProfile = false;
  final _usernameCtrl = TextEditingController();
  final _m3uUrlCtrl = TextEditingController();
  String? _addM3UForUsername;
  final _addM3UCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    final content = context.read<ContentStore>();
    final profiles = context.read<ProfileStore>().profiles;
    _expandedUsername = content.currentUsername ??
        (profiles.isNotEmpty ? profiles.first.username : null);
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
    final profileStore = context.read<ProfileStore>();
    final contentStore = context.read<ContentStore>();
    try {
      profileStore.createProfile(username);
      final uuid = profileStore.addM3UToProfile(username, url);
      await contentStore.setContent(username, uuid);
      _usernameCtrl.clear();
      _m3uUrlCtrl.clear();
      if (mounted) setState(() { _showAddProfile = false; _expandedUsername = username; });
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _addM3U(String username) async {
    final url = _addM3UCtrl.text.trim();
    if (url.isEmpty) return;
    final store = context.read<ProfileStore>();
    try {
      store.addM3UToProfile(username, url);
      _addM3UCtrl.clear();
      setState(() => _addM3UForUsername = null);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _deleteProfile(String username) async {
    final ok = await confirmDelete(context, 'Delete profile "$username"?');
    if (!ok || !mounted) return;
    await context.read<ProfileStore>().deleteProfile(username);
    if (_expandedUsername == username) setState(() => _expandedUsername = null);
  }

  Future<void> _removeM3U(String username, String uuid) async {
    final ok = await confirmDelete(context, 'Remove this M3U source?');
    if (!ok || !mounted) return;
    await context.read<ProfileStore>().removeM3UFromProfile(username, uuid);
  }

  Future<void> _load(String username, String uuid) async {
    await context.read<ContentStore>().setContent(username, uuid);
    if (mounted) widget.onLoaded?.call();
  }

  Future<void> _update(String username, String uuid) async {
    final contentStore = context.read<ContentStore>();
    await contentStore.setContent(username, uuid);
    if (mounted) await contentStore.update();
  }

  @override
  Widget build(BuildContext context) {
    final profileStore = context.watch<ProfileStore>();
    final contentStore = context.watch<ContentStore>();
    final sorted = [...profileStore.profiles]..sort((a, b) => b.lastLogin.compareTo(a.lastLogin));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ContentStatusBar(),
          if (sorted.isEmpty && !_showAddProfile)
            _EmptyState(onAdd: () => setState(() => _showAddProfile = true)),

          ...sorted.map((p) => _ProfileCard(
            profile: p,
            isExpanded: _expandedUsername == p.username,
            isActive: contentStore.currentUsername == p.username,
            activeUUID: contentStore.currentUUID,
            profileStore: profileStore,
            contentStore: contentStore,
            addM3UForUsername: _addM3UForUsername,
            addM3UCtrl: _addM3UCtrl,
            onToggleExpand: () => setState(() {
              _expandedUsername = _expandedUsername == p.username ? null : p.username;
            }),
            onLoad: (uuid) => _load(p.username, uuid),
            onUpdate: (uuid) => _update(p.username, uuid),
            onDeleteProfile: () => _deleteProfile(p.username),
            onRemoveM3U: (uuid) => _removeM3U(p.username, uuid),
            onShowAddM3U: () => setState(() { _addM3UForUsername = p.username; _addM3UCtrl.clear(); }),
            onSubmitAddM3U: () => _addM3U(p.username),
            onCancelAddM3U: () => setState(() => _addM3UForUsername = null),
          )),

          const SizedBox(height: 12),

          if (_showAddProfile)
            _AddProfileForm(
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
            _AddButton(
              label: 'Add Profile',
              onTap: () => setState(() => _showAddProfile = true),
            ),
        ],
      ),
    );
  }
}

// ── Profile card ──────────────────────────────────────────────────────────────

class _ProfileCard extends StatelessWidget {
  final Profile profile;
  final bool isExpanded;
  final bool isActive;
  final String? activeUUID;
  final ProfileStore profileStore;
  final ContentStore contentStore;
  final String? addM3UForUsername;
  final TextEditingController addM3UCtrl;
  final VoidCallback onToggleExpand;
  final Future<void> Function(String) onLoad;
  final Future<void> Function(String) onUpdate;
  final VoidCallback onDeleteProfile;
  final Future<void> Function(String) onRemoveM3U;
  final VoidCallback onShowAddM3U;
  final VoidCallback onSubmitAddM3U;
  final VoidCallback onCancelAddM3U;

  const _ProfileCard({
    required this.profile, required this.isExpanded, required this.isActive,
    required this.activeUUID, required this.profileStore, required this.contentStore,
    required this.addM3UForUsername, required this.addM3UCtrl,
    required this.onToggleExpand, required this.onLoad, required this.onUpdate,
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
                  Text('${profile.m3uRefs.length} sources', style: ZText.bodySm),
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
                      child: Text('No M3U sources.', textAlign: TextAlign.center,
                          style: ZText.body(13, color: ZColors.mutedForeground)),
                    )
                  else
                    ...profile.m3uRefs.map((uuid) => _M3UTile(
                      uuid: uuid,
                      isActiveSource: isActive && activeUUID == uuid,
                      isLoading: contentStore.isLoading && isActive && activeUUID == uuid,
                      channelCount: (isActive && activeUUID == uuid)
                          ? contentStore.calculateStats().totalWatchables
                          : null,
                      onLoad: () => onLoad(uuid),
                      onUpdate: () => onUpdate(uuid),
                      onRemove: () => onRemoveM3U(uuid),
                    )),
                  const SizedBox(height: 8),
                  if (addM3UForUsername == profile.username)
                    _InlineM3UForm(ctrl: addM3UCtrl, onSubmit: onSubmitAddM3U, onCancel: onCancelAddM3U)
                  else
                    Row(
                      children: [
                        Expanded(
                          child: _AddButton(
                            label: 'Add M3U',
                            icon: Icons.add,
                            onTap: onShowAddM3U,
                            compact: true,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextButton.icon(
                            onPressed: onDeleteProfile,
                            icon: const Icon(Icons.delete_outline, color: ZColors.destructiveFg, size: 16),
                            label: Text('Delete', style: ZText.body(13, color: ZColors.destructiveFg)),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                                side: BorderSide(color: ZColors.destructiveFg.withValues(alpha: 0.3)),
                              ),
                            ),
                          ),
                        ),
                      ],
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

class _M3UTile extends StatelessWidget {
  final String uuid;
  final bool isActiveSource;
  final bool isLoading;
  final int? channelCount;
  final VoidCallback onLoad;
  final VoidCallback onUpdate;
  final VoidCallback onRemove;

  const _M3UTile({
    required this.uuid, required this.isActiveSource, required this.isLoading,
    required this.onLoad, required this.onUpdate, required this.onRemove,
    this.channelCount,
  });

  @override
  Widget build(BuildContext context) {
    final profileStore = context.read<ProfileStore>();
    final name = m3uDisplayName(profileStore, uuid);
    return GestureDetector(
      onTap: onLoad,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: isActiveSource ? ZColors.accent : ZColors.muted,
          borderRadius: BorderRadius.circular(10),
          border: isActiveSource
              ? Border.all(color: ZColors.primary.withValues(alpha: 0.4))
              : Border.all(color: ZColors.border.withValues(alpha: 0.15)),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Row(
            children: [
              if (isActiveSource)
                Container(width: 3, height: 48, color: ZColors.primary),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(
                    left: isActiveSource ? 10 : 12,
                    right: 4,
                    top: 10,
                    bottom: 10,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.playlist_play,
                        color: isActiveSource ? ZColors.primary : ZColors.mutedForeground,
                        size: 18,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name, style: ZText.body(13, weight: FontWeight.w500)),
                            if (isLoading)
                              Text('Loading…', style: ZText.body(11, color: ZColors.primary))
                            else if (isActiveSource && channelCount != null)
                              Text('$channelCount channels', style: ZText.bodySm),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: onUpdate,
                        icon: const Icon(Icons.refresh, size: 15),
                        color: ZColors.mutedForeground,
                        padding: const EdgeInsets.all(6),
                        constraints: const BoxConstraints(),
                        tooltip: 'Update',
                      ),
                      IconButton(
                        onPressed: onRemove,
                        icon: const Icon(Icons.delete_outline, size: 15),
                        color: ZColors.destructiveFg,
                        padding: const EdgeInsets.all(6),
                        constraints: const BoxConstraints(),
                        tooltip: 'Delete',
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AddProfileForm extends StatelessWidget {
  final TextEditingController usernameCtrl;
  final TextEditingController m3uUrlCtrl;
  final VoidCallback onSubmit;
  final VoidCallback onCancel;

  const _AddProfileForm({
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
          Text('New Profile', style: ZText.headline(16)),
          const SizedBox(height: 16),
          _Field(controller: usernameCtrl, label: 'Username', hint: 'e.g. john_doe'),
          const SizedBox(height: 12),
          _Field(controller: m3uUrlCtrl, label: 'M3U URL',
              hint: 'https://example.com/playlist.m3u', keyboardType: TextInputType.url),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: ElevatedButton(onPressed: onSubmit, child: const Text('Create'))),
              const SizedBox(width: 10),
              OutlinedButton(onPressed: onCancel, child: const Text('Cancel')),
            ],
          ),
        ],
      ),
    );
  }
}

class _InlineM3UForm extends StatelessWidget {
  final TextEditingController ctrl;
  final VoidCallback onSubmit;
  final VoidCallback onCancel;

  const _InlineM3UForm({required this.ctrl, required this.onSubmit, required this.onCancel});

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
              Expanded(child: ElevatedButton(onPressed: onSubmit, child: const Text('Add'))),
              const SizedBox(width: 8),
              OutlinedButton(onPressed: onCancel, child: const Text('Cancel')),
            ],
          ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final TextInputType keyboardType;

  const _Field({
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

class _EmptyState extends StatelessWidget {
  final VoidCallback onAdd;
  const _EmptyState({required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Center(
        child: Column(
          children: [
            const Icon(Icons.person_outline, size: 48, color: ZColors.mutedForeground),
            const SizedBox(height: 12),
            Text('No profiles yet', style: ZText.body(15, color: ZColors.mutedForeground)),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: onAdd, child: const Text('Create Profile')),
          ],
        ),
      ),
    );
  }
}

class _AddButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final bool compact;

  const _AddButton({
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
