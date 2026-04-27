import 'package:flutter/material.dart';
import '../../../../core/app_theme.dart';

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

class ActiveBadge extends StatelessWidget {
  const ActiveBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: ZColors.primary.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        'ACTIVE',
        style: ZText.body(10, weight: FontWeight.w800, color: ZColors.primary),
      ),
    );
  }
}
