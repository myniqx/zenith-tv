import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';
import '../../../models/watchable.dart';

class ContentCardTv extends StatelessWidget {
  final WatchableObject item;
  const ContentCardTv({super.key, required this.item});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text('TV card — coming soon',
          style: ZText.body(14, color: ZColors.mutedForeground)),
    );
  }
}
