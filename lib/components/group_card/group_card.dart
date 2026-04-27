import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/device_type.dart';
import '../../models/group.dart';
import 'shared/group_card_base.dart';
import 'tv/group_card_tv.dart';

class GroupCard extends StatelessWidget {
  final GroupObject group;
  const GroupCard({super.key, required this.group});

  @override
  Widget build(BuildContext context) {
    final detector = context.watch<DeviceTypeDetector>();
    return switch (detector.current) {
      DeviceType.tv     => GroupCardTv(group: group),
      DeviceType.phone  ||
      DeviceType.tablet => GroupCardBase(group: group),
    };
  }
}
