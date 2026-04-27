import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';
import '../../../core/tv_focus.dart';

class AddProfileFormTv extends StatefulWidget {
  final Future<void> Function(String username, String url) onSubmit;
  final VoidCallback onCancel;

  const AddProfileFormTv({
    super.key,
    required this.onSubmit,
    required this.onCancel,
  });

  @override
  State<AddProfileFormTv> createState() => _AddProfileFormTvState();
}

class _AddProfileFormTvState extends State<AddProfileFormTv> {
  final _usernameCtrl = TextEditingController();
  final _urlCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _urlCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final username = _usernameCtrl.text.trim();
    final url = _urlCtrl.text.trim();
    if (username.isEmpty || url.isEmpty) {
      setState(() => _error = 'Tüm alanları doldurun.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await widget.onSubmit(username, url);
    } catch (e) {
      if (mounted) setState(() { _error = 'Hata: $e'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 560,
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: ZColors.secondary,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: ZColors.border.withValues(alpha: 0.2)),
        ),
        child: TvFocusScope(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Yeni Profil', style: ZText.headline(22)),
              const SizedBox(height: 4),
              Text('M3U kaynağınızı ekleyin', style: ZText.body(14, color: ZColors.mutedForeground)),
              const SizedBox(height: 28),

              _TvField(
                controller: _usernameCtrl,
                label: 'Kullanıcı Adı',
                hint: 'örn. john_doe',
                autofocus: true,
              ),
              const SizedBox(height: 16),
              _TvField(
                controller: _urlCtrl,
                label: 'M3U URL',
                hint: 'https://example.com/playlist.m3u',
                keyboardType: TextInputType.url,
              ),

              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: ZText.body(13, color: ZColors.destructiveFg)),
              ],

              const SizedBox(height: 28),

              TvHorizontalList(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TvFocusable(
                    onSelect: widget.onCancel,
                    builder: (context, focused) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      decoration: BoxDecoration(
                        color: focused ? ZColors.muted : Colors.transparent,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: ZColors.border.withValues(alpha: 0.3)),
                      ),
                      child: Text('İptal', style: ZText.body(15, weight: FontWeight.w600,
                          color: focused ? ZColors.foreground : ZColors.mutedForeground)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  TvFocusable(
                    onSelect: _loading ? null : _submit,
                    builder: (context, focused) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
                      decoration: BoxDecoration(
                        color: focused ? ZColors.primary : ZColors.primary.withValues(alpha: 0.8),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: _loading
                          ? const SizedBox(width: 18, height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: ZColors.primaryForeground))
                          : Text('Oluştur', style: ZText.body(15, weight: FontWeight.w700,
                              color: ZColors.primaryForeground)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TvField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final TextInputType keyboardType;
  final bool autofocus;

  const _TvField({
    required this.controller,
    required this.label,
    required this.hint,
    this.keyboardType = TextInputType.text,
    this.autofocus = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: ZText.body(13, weight: FontWeight.w600, color: ZColors.mutedForeground)),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          autofocus: autofocus,
          style: ZText.body(16),
          keyboardType: keyboardType,
          decoration: InputDecoration(hintText: hint),
        ),
      ],
    );
  }
}
