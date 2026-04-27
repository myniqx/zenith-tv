import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/content_store.dart';

class ToolbarTablet extends StatefulWidget {
  const ToolbarTablet({super.key});

  @override
  State<ToolbarTablet> createState() => _ToolbarTabletState();
}

class _ToolbarTabletState extends State<ToolbarTablet> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final store = context.watch<ContentStore>();

    return Container(
      height: 48,
      color: ZColors.muted,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _searchController,
              onChanged: store.setSearchQuery,
              style: ZText.body(13),
              decoration: InputDecoration(
                hintText: 'Search...',
                prefixIcon: const Icon(Icons.search, size: 16, color: ZColors.mutedForeground),
                suffixIcon: _searchController.text.isNotEmpty
                    ? GestureDetector(
                        onTap: () {
                          _searchController.clear();
                          store.setSearchQuery('');
                        },
                        child: const Icon(Icons.close, size: 14, color: ZColors.mutedForeground),
                      )
                    : null,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                filled: true,
                fillColor: ZColors.secondary,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: ZColors.border.withValues(alpha: 0.2)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: ZColors.border.withValues(alpha: 0.2)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: ZColors.primary, width: 1.5),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),

          _DropdownPicker<GroupBy>(
            value: store.groupBy,
            items: const [
              DropdownMenuItem(value: GroupBy.none,       child: Text('No Group')),
              DropdownMenuItem(value: GroupBy.group,      child: Text('By Group')),
              DropdownMenuItem(value: GroupBy.year,       child: Text('By Year')),
              DropdownMenuItem(value: GroupBy.alphabetic, child: Text('Alphabetic')),
            ],
            onChanged: (v) { if (v != null) store.setGroupBy(v); },
          ),
          const SizedBox(width: 8),

          _DropdownPicker<SortBy>(
            value: store.sortBy,
            items: const [
              DropdownMenuItem(value: SortBy.name,   child: Text('Name')),
              DropdownMenuItem(value: SortBy.date,   child: Text('Date')),
              DropdownMenuItem(value: SortBy.recent, child: Text('Recent')),
            ],
            onChanged: (v) { if (v != null) store.setSortBy(v); },
          ),
          const SizedBox(width: 4),

          GestureDetector(
            onTap: () => store.setSortOrder(
              store.sortOrder == SortOrder.asc ? SortOrder.desc : SortOrder.asc,
            ),
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: ZColors.secondary,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: ZColors.border.withValues(alpha: 0.2)),
              ),
              child: Icon(
                store.sortOrder == SortOrder.asc
                    ? Icons.keyboard_arrow_up
                    : Icons.keyboard_arrow_down,
                size: 18,
                color: ZColors.mutedForeground,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DropdownPicker<T> extends StatelessWidget {
  final T value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;

  const _DropdownPicker({
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: ZColors.secondary,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ZColors.border.withValues(alpha: 0.2)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          items: items,
          onChanged: onChanged,
          dropdownColor: ZColors.secondary,
          style: ZText.body(12),
          icon: const Icon(Icons.keyboard_arrow_down, size: 14, color: ZColors.mutedForeground),
          isDense: true,
        ),
      ),
    );
  }
}
