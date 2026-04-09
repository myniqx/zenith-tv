import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/device_type.dart';
import '../../stores/profile_store.dart';
import '../../stores/content_store.dart';

/// Profile management screen — entry point.
/// Routes to the correct layout based on DeviceType.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer2<ProfileStore, ContentStore>(
      builder: (context, profileStore, contentStore, _) {
        if (DeviceTypeDetector.isPhone) {
          return _PhoneProfileScreen(
            profileStore: profileStore,
            contentStore: contentStore,
          );
        }
        // Tablet / TV — will be added later
        return _PhoneProfileScreen(
          profileStore: profileStore,
          contentStore: contentStore,
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Phone layout — vertical scroll, single column
// ---------------------------------------------------------------------------

class _PhoneProfileScreen extends StatefulWidget {
  final ProfileStore profileStore;
  final ContentStore contentStore;

  const _PhoneProfileScreen({
    required this.profileStore,
    required this.contentStore,
  });

  @override
  State<_PhoneProfileScreen> createState() => _PhoneProfileScreenState();
}

class _PhoneProfileScreenState extends State<_PhoneProfileScreen> {
  // Which profile is expanded in the list (shows M3U sources)
  String? _expandedUsername;

  // Add-profile form state
  bool _showAddProfile = false;
  final _usernameCtrl = TextEditingController();
  final _m3uUrlCtrl = TextEditingController();

  // Add-M3U form: keyed by username
  String? _addM3UForUsername;
  final _addM3UCtrl = TextEditingController();

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _m3uUrlCtrl.dispose();
    _addM3UCtrl.dispose();
    super.dispose();
  }

  // Auto-expand current profile on first build
  @override
  void initState() {
    super.initState();
    final current = widget.profileStore.profiles.isNotEmpty
        ? widget.profileStore.profiles.first.username
        : null;
    _expandedUsername = widget.contentStore.currentUsername ?? current;
  }

  Future<void> _createProfile() async {
    final username = _usernameCtrl.text.trim();
    final url = _m3uUrlCtrl.text.trim();
    if (username.isEmpty || url.isEmpty) return;

    try {
      final profileStore = context.read<ProfileStore>();
      final contentStore = context.read<ContentStore>();

      profileStore.createProfile(username);
      final uuid = profileStore.addM3UToProfile(username, url);
      final profile = profileStore.getProfile(username);
      debugPrint('[ProfileScreen] created profile: $username, m3uRefs=${profile?.m3uRefs}, uuid=$uuid');
      debugPrint('[ProfileScreen] setContent($username, $uuid)');
      await contentStore.setContent(username, uuid);
      debugPrint('[ProfileScreen] setContent done, isReady=${contentStore.isReady}, total=${contentStore.calculateStats().totalWatchables}');

      _usernameCtrl.clear();
      _m3uUrlCtrl.clear();
      if (mounted) {
        setState(() {
          _showAddProfile = false;
          _expandedUsername = username;
        });
      }
    } catch (e) {
      debugPrint('[ProfileScreen] createProfile error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
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
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _deleteProfile(String username) async {
    final confirmed = await _showDeleteDialog(
      context,
      'Delete profile "$username" and all its data?',
    );
    if (confirmed != true) return;
    await widget.profileStore.deleteProfile(username);
    if (_expandedUsername == username) {
      setState(() => _expandedUsername = null);
    }
  }

  Future<void> _removeM3U(String username, String uuid) async {
    final confirmed = await _showDeleteDialog(
      context,
      'Remove this M3U source from the profile?',
    );
    if (confirmed != true) return;
    await widget.profileStore.removeM3UFromProfile(username, uuid);
  }

  @override
  Widget build(BuildContext context) {
    final profiles = widget.profileStore.profiles;
    // Sort by lastLogin descending
    final sorted = [...profiles]
      ..sort((a, b) => b.lastLogin.compareTo(a.lastLogin));

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        title: const Text('Profiles', style: TextStyle(color: Color(0xFFEF4444))),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Profile list
            if (sorted.isEmpty && !_showAddProfile)
              _EmptyProfiles(onAdd: () => setState(() => _showAddProfile = true)),

            ...sorted.map((p) => _ProfileCard(
                  profile: p,
                  isExpanded: _expandedUsername == p.username,
                  isActive: widget.contentStore.currentUsername == p.username,
                  activeUUID: widget.contentStore.currentUUID,
                  profileStore: widget.profileStore,
                  contentStore: widget.contentStore,
                  addM3UForUsername: _addM3UForUsername,
                  addM3UCtrl: _addM3UCtrl,
                  onToggleExpand: () {
                    debugPrint('[ProfileScreen] onToggleExpand: ${p.username}, m3uRefs.length=${p.m3uRefs.length}');
                    if (p.m3uRefs.length == 1) {
                      debugPrint('[ProfileScreen] single source, activate ${p.m3uRefs.first}');
                      context.read<ContentStore>().setContent(p.username, p.m3uRefs.first);
                    } else {
                      setState(() {
                        _expandedUsername = _expandedUsername == p.username
                            ? null
                            : p.username;
                      });
                    }
                  },
                  onActivate: (uuid) {
                    debugPrint('[ProfileScreen] activate $uuid for ${p.username}');
                    return context.read<ContentStore>().setContent(p.username, uuid);
                  },
                  onDeleteProfile: () => _deleteProfile(p.username),
                  onRemoveM3U: (uuid) => _removeM3U(p.username, uuid),
                  onShowAddM3U: () => setState(() {
                    _addM3UForUsername = p.username;
                    _addM3UCtrl.clear();
                  }),
                  onSubmitAddM3U: () => _addM3U(p.username),
                  onCancelAddM3U: () =>
                      setState(() => _addM3UForUsername = null),
                )),

            const SizedBox(height: 12),

            // Add profile form or button
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
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Profile card — collapsed shows name + active badge + expand arrow
//               expanded shows M3U sources + add button
// ---------------------------------------------------------------------------

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
  final Future<void> Function(String uuid) onActivate;
  final VoidCallback onDeleteProfile;
  final Future<void> Function(String uuid) onRemoveM3U;
  final VoidCallback onShowAddM3U;
  final VoidCallback onSubmitAddM3U;
  final VoidCallback onCancelAddM3U;

  const _ProfileCard({
    required this.profile,
    required this.isExpanded,
    required this.isActive,
    required this.activeUUID,
    required this.profileStore,
    required this.contentStore,
    required this.addM3UForUsername,
    required this.addM3UCtrl,
    required this.onToggleExpand,
    required this.onActivate,
    required this.onDeleteProfile,
    required this.onRemoveM3U,
    required this.onShowAddM3U,
    required this.onSubmitAddM3U,
    required this.onCancelAddM3U,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: isActive
            ? Border.all(color: const Color(0xFFEF4444), width: 1.5)
            : null,
      ),
      child: Column(
        children: [
          // Header row
          InkWell(
            onTap: onToggleExpand,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  const Icon(Icons.person, color: Color(0xFF94A3B8), size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      profile.username,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (isActive)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFF7F1D1D),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'Active',
                        style: TextStyle(
                            color: Color(0xFFFCA5A5), fontSize: 11),
                      ),
                    ),
                  const SizedBox(width: 8),
                  Text(
                    '${profile.m3uRefs.length} source${profile.m3uRefs.length != 1 ? 's' : ''}',
                    style: const TextStyle(
                        color: Color(0xFF64748B), fontSize: 12),
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    isExpanded ? Icons.expand_less : Icons.expand_more,
                    color: const Color(0xFF64748B),
                  ),
                ],
              ),
            ),
          ),

          // Expanded: M3U sources
          if (isExpanded) ...[
            const Divider(color: Color(0xFF334155), height: 1),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  if (profile.m3uRefs.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Center(
                        child: Text(
                          'No M3U sources.\nAdd one to get started.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              color: Colors.grey.shade600,
                              fontSize: 13,
                              height: 1.6),
                        ),
                      ),
                    )
                  else
                    ...profile.m3uRefs.map((uuid) => _M3UTile(
                          uuid: uuid,
                          isActiveSource: isActive && activeUUID == uuid,
                          profileStore: profileStore,
                          contentStore: contentStore,
                          onActivate: () => onActivate(uuid),
                          onRemove: () => onRemoveM3U(uuid),
                        )),

                  // Add M3U inline form
                  if (addM3UForUsername == profile.username)
                    _InlineM3UForm(
                      ctrl: addM3UCtrl,
                      onSubmit: onSubmitAddM3U,
                      onCancel: onCancelAddM3U,
                    )
                  else
                    _AddButton(
                      label: 'Add M3U Source',
                      icon: Icons.add,
                      onTap: onShowAddM3U,
                      compact: true,
                    ),

                  const SizedBox(height: 8),
                  // Delete profile button
                  SizedBox(
                    width: double.infinity,
                    child: TextButton.icon(
                      onPressed: onDeleteProfile,
                      icon: const Icon(Icons.delete_outline,
                          color: Colors.red, size: 16),
                      label: const Text('Delete Profile',
                          style: TextStyle(color: Colors.red, fontSize: 13)),
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

// ---------------------------------------------------------------------------
// M3U source tile inside a profile card
// ---------------------------------------------------------------------------

class _M3UTile extends StatelessWidget {
  final String uuid;
  final bool isActiveSource;
  final ProfileStore profileStore;
  final ContentStore contentStore;
  final VoidCallback onActivate;
  final VoidCallback onRemove;

  const _M3UTile({
    required this.uuid,
    required this.isActiveSource,
    required this.profileStore,
    required this.contentStore,
    required this.onActivate,
    required this.onRemove,
  });

  String _displayName() {
    final url = profileStore.getUrlFromUUID(uuid);
    if (url == null) return uuid.substring(0, 8);
    try {
      final uri = Uri.parse(url);
      final seg = uri.pathSegments.lastWhere((s) => s.isNotEmpty,
          orElse: () => uri.host);
      return seg.length > 40 ? '${seg.substring(0, 40)}…' : seg;
    } catch (_) {
      return url.length > 40 ? '${url.substring(0, 40)}…' : url;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isActiveSource
            ? const Color(0xFF1E3A5F)
            : const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(8),
        border: isActiveSource
            ? Border.all(color: Colors.blue.shade700)
            : null,
      ),
      child: Row(
        children: [
          const Icon(Icons.playlist_play,
              color: Color(0xFF94A3B8), size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _displayName(),
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w500),
                ),
                if (contentStore.isLoading && isActiveSource)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('Loading…',
                        style: TextStyle(
                            color: Colors.blue.shade300, fontSize: 11)),
                  )
                else if (isActiveSource)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '${contentStore.calculateStats().totalWatchables} channels',
                      style: const TextStyle(
                          color: Color(0xFF64748B), fontSize: 11),
                    ),
                  ),
              ],
            ),
          ),
          if (!isActiveSource)
            TextButton(
              onPressed: onActivate,
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFFEF4444),
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text('Activate', style: TextStyle(fontSize: 12)),
            )
          else
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.blue.shade900,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text('Active',
                  style: TextStyle(color: Colors.blue, fontSize: 11)),
            ),
          const SizedBox(width: 4),
          IconButton(
            onPressed: onRemove,
            icon: const Icon(Icons.close, size: 16),
            color: Colors.grey,
            padding: const EdgeInsets.all(4),
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Add profile form
// ---------------------------------------------------------------------------

class _AddProfileForm extends StatelessWidget {
  final TextEditingController usernameCtrl;
  final TextEditingController m3uUrlCtrl;
  final VoidCallback onSubmit;
  final VoidCallback onCancel;

  const _AddProfileForm({
    required this.usernameCtrl,
    required this.m3uUrlCtrl,
    required this.onSubmit,
    required this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'New Profile',
            style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          _Field(
            controller: usernameCtrl,
            label: 'Username',
            hint: 'e.g. john_doe',
          ),
          const SizedBox(height: 12),
          _Field(
            controller: m3uUrlCtrl,
            label: 'M3U URL',
            hint: 'https://example.com/playlist.m3u',
            keyboardType: TextInputType.url,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: onSubmit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEF4444),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('Create Profile'),
                ),
              ),
              const SizedBox(width: 10),
              OutlinedButton(
                onPressed: onCancel,
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Color(0xFF475569)),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 20, vertical: 14),
                ),
                child: const Text('Cancel'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Inline M3U add form (inside expanded profile card)
// ---------------------------------------------------------------------------

class _InlineM3UForm extends StatelessWidget {
  final TextEditingController ctrl;
  final VoidCallback onSubmit;
  final VoidCallback onCancel;

  const _InlineM3UForm({
    required this.ctrl,
    required this.onSubmit,
    required this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        children: [
          TextField(
            controller: ctrl,
            style: const TextStyle(color: Colors.white, fontSize: 13),
            keyboardType: TextInputType.url,
            decoration: InputDecoration(
              hintText: 'https://example.com/playlist.m3u',
              hintStyle: const TextStyle(color: Color(0xFF475569)),
              filled: true,
              fillColor: const Color(0xFF0F172A),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: BorderSide.none,
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
            onSubmitted: (_) => onSubmit(),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: onSubmit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF334155),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Add', style: TextStyle(fontSize: 13)),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: onCancel,
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Color(0xFF475569)),
                ),
                child:
                    const Text('Cancel', style: TextStyle(fontSize: 13)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class _Field extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final TextInputType keyboardType;

  const _Field({
    required this.controller,
    required this.label,
    required this.hint,
    this.keyboardType = TextInputType.text,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          style: const TextStyle(color: Colors.white),
          keyboardType: keyboardType,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFF475569)),
            filled: true,
            fillColor: const Color(0xFF0F172A),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(6),
              borderSide: BorderSide.none,
            ),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ],
    );
  }
}

class _AddButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final bool compact;

  const _AddButton({
    required this.label,
    required this.onTap,
    this.icon = Icons.add,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: compact ? 16 : 18),
        label: Text(label, style: TextStyle(fontSize: compact ? 13 : 14)),
        style: OutlinedButton.styleFrom(
          foregroundColor: Colors.white,
          side: const BorderSide(color: Color(0xFF334155), style: BorderStyle.solid),
          padding: EdgeInsets.symmetric(vertical: compact ? 10 : 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      ),
    );
  }
}

class _EmptyProfiles extends StatelessWidget {
  final VoidCallback onAdd;

  const _EmptyProfiles({required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Column(
          children: [
            Icon(Icons.person_outline, size: 64, color: Colors.grey.shade700),
            const SizedBox(height: 16),
            Text(
              'No profiles yet',
              style: TextStyle(color: Colors.grey.shade500, fontSize: 16),
            ),
            const SizedBox(height: 8),
            Text(
              'Create a profile and add an M3U source\nto get started.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: Colors.grey.shade600, fontSize: 13, height: 1.6),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add),
              label: const Text('Create Profile'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                    horizontal: 24, vertical: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

Future<bool?> _showDeleteDialog(BuildContext context, String message) {
  return showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: const Color(0xFF1E293B),
      title: const Text('Are you sure?',
          style: TextStyle(color: Colors.white)),
      content:
          Text(message, style: const TextStyle(color: Color(0xFF94A3B8))),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Cancel',
              style: TextStyle(color: Color(0xFF94A3B8))),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          style: TextButton.styleFrom(foregroundColor: Colors.red),
          child: const Text('Delete'),
        ),
      ],
    ),
  );
}
