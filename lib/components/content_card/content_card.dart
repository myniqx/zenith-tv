import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/device_type.dart';
import '../../models/watchable.dart';
import 'shared/content_card_base.dart';
import 'tv/content_card_tv.dart';

class ContentCard extends StatelessWidget {
  final WatchableObject item;
  const ContentCard({super.key, required this.item});

  @override
  Widget build(BuildContext context) {
    final detector = context.watch<DeviceTypeDetector>();
    return switch (detector.current) {
      DeviceType.tv    => ContentCardTv(item: item),
      DeviceType.phone  ||
      DeviceType.tablet => ContentCardBase(item: item),
    };
  }
}
