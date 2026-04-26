import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/profile_store.dart';
import '../../../stores/content_store.dart';
import '../shared/profile_avatar.dart';
import '../shared/delete_dialog.dart';
import '../shared/m3u_display.dart';

class ProfileManagerTablet extends StatefulWidget {
  final VoidCallback? onLoaded;

  const ProfileManagerTablet({super.key, this.onLoaded});

  @override
  State<ProfileManagerTablet> createState() => _ProfileManagerTabletState();
}

class _ProfileManagerTabletState extends State<ProfileManagerTablet> {
  String? _selectedUsername;
  bool _showAddProfile = false;

  @override
  void initState() {
    super.initState();
    final content  = context.read<ContentStore>();
    final profiles = context.read<ProfileStore>().profiles;
    final sorted   = [...profiles]..sort((a, b) => b.lastLogin.compareTo(a.lastLogin));
    _selectedUsername = content.currentUsername ??
        (sorted.isNotEmpty ? sorted.first.username : null);
  }

  void _onDeletedProfile(String username) {
    if (_selectedUsername == username) setState(() => _selectedUsername = null);
  }

  @override
  Widget build(BuildContext context) {
    final profileStore = context.watch<ProfileStore>();
    final contentStore = context.watch<ContentStore>();
    final sorted = [...profileStore.profiles]..sort((a, b) => b.lastLogin.compareTo(a.lastLogin));

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left: profile list
        SizedBox(
          width: 220,
          child: _ProfileList(
            profiles: sorted,
            selectedUsername: _selectedUsername,
            currentUsername: contentStore.currentUsername,
            onSelect: (u) => setState(() { _selectedUsername = u; _showAddProfile = false; }),
            onAdd: () => setState(() { _showAddProfile = true; _selectedUsername = null; }),
          ),
        ),
        const SizedBox(width: 16),
        // Right: content panel
        Expanded(
          child: _showAddProfile
              ? _AddProfilePanel(
                  onDone: (username) => setState(() {
                    _showAddProfile = false;
                    _selectedUsername = username;
                  }),
                  onCancel: () => setState(() => _showAddProfile = false),
                )
              : _selectedUsername != null
                  ? _M3UPanel(
                      username: _selectedUsername!,
                      profileStore: profileStore,
                      contentStore: contentStore,
                      onDeleted: () => _onDeletedProfile(_selectedUsername!),
                      onLoaded: widget.onLoaded,
                    )
                  : _EmptyRight(),
        ),
      ],
    );
  }
}

// ── Left: profile list ────────────────────────────────────────────────────────

class _ProfileList extends StatelessWidget {
  final List<Profile> profiles;
  final String? selectedUsername;
  final String? currentUsername;
  final void Function(String) onSelect;
  final VoidCallback onAdd;

  const _ProfileList({
    required this.profiles, required this.selectedUsername,
    required this.currentUsername, required this.onSelect, required this.onAdd,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8, left: 2),
          child: Text('Profiles', style: ZText.labelUpper),
        ),
        ...profiles.map((p) => _ProfileRow(
          profile: p,
          isSelected: selectedUsername == p.username,
          isActive: currentUsername == p.username,
          onTap: () => onSelect(p.username),
        )),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: onAdd,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: ZColors.border.withValues(alpha: 0.25),
                  style: BorderStyle.solid),
            ),
            child: Row(
              children: [
                const Icon(Icons.add, size: 16, color: ZColors.mutedForeground),
                const SizedBox(width: 8),
                Text('New Profile',
                    style: ZText.body(13, color: ZColors.mutedForeground)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ProfileRow extends StatelessWidget {
  final Profile profile;
  final bool isSelected;
  final bool isActive;
  final VoidCallback onTap;

  const _ProfileRow({
    required this.profile, required this.isSelected,
    required this.isActive, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? ZColors.accent : ZColors.secondary,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected
                ? ZColors.primary.withValues(alpha: 0.4)
                : ZColors.border.withValues(alpha: 0.15),
          ),
        ),
        child: Row(
          children: [
            ProfileAvatar(isActive: isActive, size: 30),
            const SizedBox(width: 10),
            Expanded(
              child: Text(profile.username,
                  style: ZText.body(13, weight: FontWeight.w600,
                      color: isSelected ? ZColors.primary : ZColors.foreground),
                  overflow: TextOverflow.ellipsis),
            ),
            if (isActive)
              Container(
                width: 6, height: 6,
                decoration: const BoxDecoration(
                  color: ZColors.primary, shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Right: M3U panel ──────────────────────────────────────────────────────────

class _M3UPanel extends StatefulWidget {
  final String username;
  final ProfileStore profileStore;
  final ContentStore contentStore;
  final VoidCallback onDeleted;
  final VoidCallback? onLoaded;

  const _M3UPanel({
    required this.username, required this.profileStore,
    required this.contentStore, required this.onDeleted,
    this.onLoaded,
  });

  @override
  State<_M3UPanel> createState() => _M3UPanelState();
}

class _M3UPanelState extends State<_M3UPanel> {
  bool _showAddM3U = false;
  final _addM3UCtrl = TextEditingController();

  @override
  void dispose() {
    _addM3UCtrl.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(_M3UPanel old) {
    super.didUpdateWidget(old);
    if (old.username != widget.username) {
      _showAddM3U = false;
      _addM3UCtrl.clear();
    }
  }

  Future<void> _load(String uuid) async {
    await widget.contentStore.setContent(widget.username, uuid);
    if (mounted) widget.onLoaded?.call();
  }

  Future<void> _update(String uuid) async {
    await widget.contentStore.setContent(widget.username, uuid);
    if (mounted) await widget.contentStore.update();
  }

  Future<void> _addM3U() async {
    final url = _addM3UCtrl.text.trim();
    if (url.isEmpty) return;
    try {
      widget.profileStore.addM3UToProfile(widget.username, url);
      _addM3UCtrl.clear();
      setState(() => _showAddM3U = false);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _removeM3U(String uuid) async {
    final ok = await confirmDelete(context, 'Remove this M3U source?');
    if (!ok) return;
    await widget.profileStore.removeM3UFromProfile(widget.username, uuid);
  }

  Future<void> _deleteProfile() async {
    final ok = await confirmDelete(context, 'Delete profile "${widget.username}"?');
    if (!ok) return;
    await widget.profileStore.deleteProfile(widget.username);
    widget.onDeleted();
  }

  @override
  Widget build(BuildContext context) {
    final profile = widget.profileStore.profiles
        .where((p) => p.username == widget.username)
        .firstOrNull;
    if (profile == null) return const SizedBox.shrink();

    final isActive = widget.contentStore.currentUsername == widget.username;
    final activeUUID = widget.contentStore.currentUUID;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Profile header
          Row(
            children: [
              ProfileAvatar(isActive: isActive, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(profile.username, style: ZText.headline(18)),
                    Text('${profile.m3uRefs.length} sources', style: ZText.bodySm),
                  ],
                ),
              ),
              if (isActive) const ActiveBadge(),
              const SizedBox(width: 8),
              IconButton(
                onPressed: _deleteProfile,
                icon: const Icon(Icons.delete_outline, size: 18),
                color: ZColors.mutedForeground,
                tooltip: 'Delete profile',
              ),
            ],
          ),
          const SizedBox(height: 20),

          // M3U sources label
          Text('M3U Sources', style: ZText.labelUpper),
          const SizedBox(height: 10),

          if (profile.m3uRefs.isEmpty && !_showAddM3U)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Center(
                child: Text('No M3U sources.',
                    style: ZText.body(14, color: ZColors.mutedForeground)),
              ),
            ),

          ...profile.m3uRefs.map((uuid) {
            final isActiveSource = isActive && activeUUID == uuid;
            final name = m3uDisplayName(widget.profileStore, uuid);
            return _TabletM3UTile(
              name: name,
              isActiveSource: isActiveSource,
              isLoading: widget.contentStore.isLoading && isActiveSource,
              channelCount: isActiveSource
                  ? widget.contentStore.calculateStats().totalWatchables
                  : null,
              onLoad: () => _load(uuid),
              onUpdate: () => _update(uuid),
              onRemove: () => _removeM3U(uuid),
            );
          }),

          const SizedBox(height: 8),

          if (_showAddM3U)
            _AddM3UForm(
              ctrl: _addM3UCtrl,
              onSubmit: _addM3U,
              onCancel: () => setState(() { _showAddM3U = false; _addM3UCtrl.clear(); }),
            )
          else
            GestureDetector(
              onTap: () => setState(() => _showAddM3U = true),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: ZColors.border.withValues(alpha: 0.25),
                      style: BorderStyle.solid),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.add, size: 16, color: ZColors.mutedForeground),
                    const SizedBox(width: 6),
                    Text('Add M3U Source',
                        style: ZText.body(13, color: ZColors.mutedForeground)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _TabletM3UTile extends StatelessWidget {
  final String name;
  final bool isActiveSource;
  final bool isLoading;
  final int? channelCount;
  final VoidCallback onLoad;
  final VoidCallback onUpdate;
  final VoidCallback onRemove;

  const _TabletM3UTile({
    required this.name,
    required this.isActiveSource,
    required this.isLoading,
    required this.onLoad,
    required this.onUpdate,
    required this.onRemove,
    this.channelCount,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onLoad,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: isActiveSource ? ZColors.accent : ZColors.secondary,
          borderRadius: BorderRadius.circular(10),
          border: isActiveSource
              ? Border.all(color: ZColors.primary.withValues(alpha: 0.4))
              : Border.all(color: ZColors.border.withValues(alpha: 0.15)),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Row(
            children: [
              // Active indicator bar
              if (isActiveSource)
                Container(width: 3, height: 56, color: ZColors.primary),

              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(
                    left: isActiveSource ? 12 : 14,
                    right: 4,
                    top: 12,
                    bottom: 12,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.playlist_play,
                        color: isActiveSource ? ZColors.primary : ZColors.mutedForeground,
                        size: 18,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name, style: ZText.body(14, weight: FontWeight.w500)),
                            if (isLoading)
                              Text('Loading…', style: ZText.body(11, color: ZColors.primary))
                            else if (isActiveSource && channelCount != null)
                              Text('$channelCount channels', style: ZText.bodySm),
                          ],
                        ),
                      ),
                      // Update button
                      IconButton(
                        onPressed: onUpdate,
                        icon: const Icon(Icons.refresh, size: 16),
                        color: ZColors.mutedForeground,
                        padding: const EdgeInsets.all(6),
                        constraints: const BoxConstraints(),
                        tooltip: 'Update',
                      ),
                      // Delete button
                      IconButton(
                        onPressed: onRemove,
                        icon: const Icon(Icons.delete_outline, size: 16),
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

class _AddM3UForm extends StatelessWidget {
  final TextEditingController ctrl;
  final VoidCallback onSubmit;
  final VoidCallback onCancel;

  const _AddM3UForm({required this.ctrl, required this.onSubmit, required this.onCancel});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ZColors.muted,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          TextField(
            controller: ctrl,
            style: ZText.body(14),
            keyboardType: TextInputType.url,
            autofocus: true,
            decoration: const InputDecoration(
              hintText: 'https://example.com/playlist.m3u',
              labelText: 'M3U URL',
            ),
            onSubmitted: (_) => onSubmit(),
          ),
          const SizedBox(height: 10),
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

// ── Right: add profile panel ──────────────────────────────────────────────────

class _AddProfilePanel extends StatefulWidget {
  final void Function(String username) onDone;
  final VoidCallback onCancel;

  const _AddProfilePanel({required this.onDone, required this.onCancel});

  @override
  State<_AddProfilePanel> createState() => _AddProfilePanelState();
}

class _AddProfilePanelState extends State<_AddProfilePanel> {
  final _usernameCtrl = TextEditingController();
  final _m3uUrlCtrl = TextEditingController();

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _m3uUrlCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final username = _usernameCtrl.text.trim();
    final url = _m3uUrlCtrl.text.trim();
    if (username.isEmpty || url.isEmpty) return;
    final profileStore = context.read<ProfileStore>();
    final contentStore = context.read<ContentStore>();
    try {
      profileStore.createProfile(username);
      final uuid = profileStore.addM3UToProfile(username, url);
      await contentStore.setContent(username, uuid);
      widget.onDone(username);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('New Profile', style: ZText.headline(18)),
        const SizedBox(height: 20),
        _LabeledField(ctrl: _usernameCtrl, label: 'Username', hint: 'e.g. john_doe'),
        const SizedBox(height: 14),
        _LabeledField(ctrl: _m3uUrlCtrl, label: 'M3U URL',
            hint: 'https://example.com/playlist.m3u',
            keyboardType: TextInputType.url),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(child: ElevatedButton(onPressed: _submit, child: const Text('Create'))),
            const SizedBox(width: 10),
            OutlinedButton(onPressed: widget.onCancel, child: const Text('Cancel')),
          ],
        ),
      ],
    );
  }
}

class _LabeledField extends StatelessWidget {
  final TextEditingController ctrl;
  final String label;
  final String hint;
  final TextInputType keyboardType;

  const _LabeledField({
    required this.ctrl, required this.label, required this.hint,
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
          controller: ctrl,
          style: ZText.body(14),
          keyboardType: keyboardType,
          decoration: InputDecoration(hintText: hint),
        ),
      ],
    );
  }
}

// ── Empty right state ─────────────────────────────────────────────────────────

class _EmptyRight extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.person_outline, size: 48, color: ZColors.mutedForeground),
          const SizedBox(height: 12),
          Text('Select a profile or create a new one',
              style: ZText.body(14, color: ZColors.mutedForeground)),
        ],
      ),
    );
  }
}
