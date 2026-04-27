import 'package:flutter/material.dart';
import '../../../core/app_theme.dart';
import '../../../models/group.dart';
import '../../../models/watchable.dart';
import '../../../stores/content_store.dart';
import '../../content_card/content_card.dart';
import '../../group_card/group_card.dart';

const _pageSizeOptions = [20, 50, 100];

class ContentGroup extends StatefulWidget {
  final ContentGroupData data;
  final int crossAxisCount;

  const ContentGroup({
    super.key,
    required this.data,
    required this.crossAxisCount,
  });

  @override
  State<ContentGroup> createState() => _ContentGroupState();
}

class _ContentGroupState extends State<ContentGroup> {
  int _pageSize = 20;
  int _currentPage = 0;

  int get _totalItems => widget.data.items.length;
  int get _totalPages => (_totalItems / _pageSize).ceil().clamp(1, 9999);

  List<dynamic> get _pageItems {
    final start = _currentPage * _pageSize;
    final end = (start + _pageSize).clamp(0, _totalItems);
    return widget.data.items.sublist(start, end);
  }

  @override
  void didUpdateWidget(ContentGroup old) {
    super.didUpdateWidget(old);
    if (_currentPage >= _totalPages) {
      setState(() => _currentPage = (_totalPages - 1).clamp(0, 9999));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.data.items.isEmpty) return const SizedBox.shrink();

    final start = _currentPage * _pageSize + 1;
    final end = ((_currentPage + 1) * _pageSize).clamp(0, _totalItems);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Sticky-style section header
        Container(
          color: ZColors.muted.withValues(alpha: 0.95),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Expanded(
                child: Text(widget.data.title,
                    style: ZText.body(15, weight: FontWeight.w600)),
              ),
              Text('$start–$end of $_totalItems',
                  style: ZText.bodySm),
              const SizedBox(width: 8),
              _PageSizeDropdown(
                value: _pageSize,
                onChanged: (v) => setState(() {
                  _pageSize = v;
                  _currentPage = 0;
                }),
              ),
              const SizedBox(width: 4),
              _PaginationControls(
                currentPage: _currentPage,
                totalPages: _totalPages,
                onFirst: () => setState(() => _currentPage = 0),
                onPrev: () =>
                    setState(() => _currentPage = (_currentPage - 1).clamp(0, _totalPages - 1)),
                onNext: () =>
                    setState(() => _currentPage = (_currentPage + 1).clamp(0, _totalPages - 1)),
                onLast: () => setState(() => _currentPage = _totalPages - 1),
              ),
            ],
          ),
        ),

        // Grid
        Padding(
          padding: const EdgeInsets.all(12),
          child: GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: widget.crossAxisCount,
              childAspectRatio: 2 / 3,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            itemCount: _pageItems.length,
            itemBuilder: (context, i) {
              final item = _pageItems[i];
              if (item is WatchableObject) {
                return ContentCard(item: item);
              } else if (item is GroupObject) {
                return GroupCard(group: item);
              }
              return const SizedBox.shrink();
            },
          ),
        ),
      ],
    );
  }
}

class _PageSizeDropdown extends StatelessWidget {
  final int value;
  final ValueChanged<int> onChanged;

  const _PageSizeDropdown({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 28,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.2)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          value: value,
          isDense: true,
          dropdownColor: ZColors.secondary,
          style: ZText.body(12),
          icon: const Icon(Icons.keyboard_arrow_down,
              size: 14, color: ZColors.mutedForeground),
          items: _pageSizeOptions
              .map((s) => DropdownMenuItem(value: s, child: Text('$s')))
              .toList(),
          onChanged: (v) { if (v != null) onChanged(v); },
        ),
      ),
    );
  }
}

class _PaginationControls extends StatelessWidget {
  final int currentPage;
  final int totalPages;
  final VoidCallback onFirst;
  final VoidCallback onPrev;
  final VoidCallback onNext;
  final VoidCallback onLast;

  const _PaginationControls({
    required this.currentPage,
    required this.totalPages,
    required this.onFirst,
    required this.onPrev,
    required this.onNext,
    required this.onLast,
  });

  @override
  Widget build(BuildContext context) {
    final atStart = currentPage == 0;
    final atEnd = currentPage >= totalPages - 1;

    return Row(
      children: [
        _PagBtn(icon: Icons.first_page, onTap: atStart ? null : onFirst),
        _PagBtn(icon: Icons.chevron_left, onTap: atStart ? null : onPrev),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: Text('${currentPage + 1} / $totalPages',
              style: ZText.bodySm),
        ),
        _PagBtn(icon: Icons.chevron_right, onTap: atEnd ? null : onNext),
        _PagBtn(icon: Icons.last_page, onTap: atEnd ? null : onLast),
      ],
    );
  }
}

class _PagBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;

  const _PagBtn({required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 28, height: 28,
        alignment: Alignment.center,
        child: Icon(icon, size: 18,
            color: onTap != null
                ? ZColors.mutedForeground
                : ZColors.border),
      ),
    );
  }
}
