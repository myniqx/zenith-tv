import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/content_store.dart';
import '../../category_browser/category_browser.dart';

class ToolbarPhone extends StatefulWidget {
  const ToolbarPhone({super.key});

  @override
  State<ToolbarPhone> createState() => _ToolbarPhoneState();
}

class _ToolbarPhoneState extends State<ToolbarPhone> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _openDrawer(BuildContext context) {
    Scaffold.of(context).openDrawer();
  }

  @override
  Widget build(BuildContext context) {
    final store = context.watch<ContentStore>();

    return Container(
      height: 48,
      color: ZColors.muted,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Row(
        children: [
          // Hamburger — opens CategoryBrowser drawer
          GestureDetector(
            onTap: () => _openDrawer(context),
            child: Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              child: const Icon(Icons.menu, size: 20, color: ZColors.mutedForeground),
            ),
          ),
          const SizedBox(width: 4),

          // Search
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
                        child: const Icon(Icons.close, size: 14,
                            color: ZColors.mutedForeground),
                      )
                    : null,
                isDense: true,
                contentPadding:
                    const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                filled: true,
                fillColor: ZColors.secondary,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide:
                      BorderSide(color: ZColors.border.withValues(alpha: 0.2)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide:
                      BorderSide(color: ZColors.border.withValues(alpha: 0.2)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: ZColors.primary, width: 1.5),
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),

          // Sort order toggle
          GestureDetector(
            onTap: () => store.setSortOrder(
              store.sortOrder == SortOrder.asc ? SortOrder.desc : SortOrder.asc,
            ),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: ZColors.secondary,
                borderRadius: BorderRadius.circular(8),
                border:
                    Border.all(color: ZColors.border.withValues(alpha: 0.2)),
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

/// Drawer content — wraps CategoryBrowser for phone.
class CategoryDrawer extends StatelessWidget {
  const CategoryDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: ZColors.muted,
      width: 260,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  Text('Categories', style: ZText.headline(16)),
                  const Spacer(),
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: const Icon(Icons.close,
                        size: 18, color: ZColors.mutedForeground),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            const Expanded(child: CategoryBrowser()),
          ],
        ),
      ),
    );
  }
}
