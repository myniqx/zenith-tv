import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../models/group.dart';
import '../../../stores/content_store.dart';

class GroupCardBase extends StatelessWidget {
  final GroupObject group;
  const GroupCardBase({super.key, required this.group});

  @override
  Widget build(BuildContext context) {
    final covers = group.getImageList(9);

    return GestureDetector(
      onTap: () => context.read<ContentStore>().setGroup(group),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  covers.isNotEmpty
                      ? _CoverCollage(covers: covers)
                      : _GroupFallback(),
                  Positioned(
                    top: 6, right: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text('${group.totalCount}',
                          style: ZText.body(11)),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(group.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: ZText.body(12, weight: FontWeight.w500)),
          if (group.groups.isNotEmpty)
            Text('${group.groups.length} subgroups',
                style: ZText.bodySm),
        ],
      ),
    );
  }
}

class _CoverCollage extends StatelessWidget {
  final List<CoverItem> covers;
  const _CoverCollage({required this.covers});

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3, crossAxisSpacing: 1, mainAxisSpacing: 1,
      ),
      itemCount: 9,
      itemBuilder: (_, i) {
        if (i < covers.length && covers[i].logo.isNotEmpty) {
          return Image.network(covers[i].logo,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stack) => const _CollageCell());
        }
        return const _CollageCell();
      },
    );
  }
}

class _CollageCell extends StatelessWidget {
  const _CollageCell();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: ZColors.secondary,
      child: const Icon(Icons.folder_outlined,
          color: ZColors.border, size: 16),
    );
  }
}

class _GroupFallback extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [ZColors.secondary, ZColors.background],
        ),
      ),
      child: const Icon(Icons.folder_outlined,
          color: ZColors.border, size: 48),
    );
  }
}
