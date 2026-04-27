import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';

class CategoryItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final int? count;
  final bool isActive;
  final VoidCallback onTap;

  const CategoryItem({
    super.key,
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
    this.count,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: isActive ? ZColors.accent : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(icon, size: 16,
                color: isActive ? ZColors.primary : ZColors.mutedForeground),
            const SizedBox(width: 10),
            Expanded(
              child: Text(label,
                  style: ZText.body(13,
                      weight: isActive ? FontWeight.w600 : FontWeight.w400,
                      color: isActive ? ZColors.primary : ZColors.foreground)),
            ),
            if (count != null && count! > 0)
              Text('$count', style: ZText.body(11, color: ZColors.mutedForeground)),
          ],
        ),
      ),
    );
  }
}
