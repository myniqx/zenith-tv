import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';
import '../../../models/group.dart';

class GroupCardTv extends StatelessWidget {
  final GroupObject group;
  const GroupCardTv({super.key, required this.group});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text('TV group card — coming soon',
          style: ZText.body(14, color: ZColors.mutedForeground)),
    );
  }
}
