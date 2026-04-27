import 'package:flutter/material.dart';
import '../../../../core/app_theme.dart';

Future<bool> confirmDelete(BuildContext context, String message) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: ZColors.secondary,
      title: Text('Are you sure?', style: ZText.headline(16)),
      content: Text(message, style: ZText.body(14)),
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
  return result ?? false;
}
