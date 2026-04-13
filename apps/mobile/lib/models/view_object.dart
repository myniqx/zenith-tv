import 'group.dart';

/// Base class for all displayable items (groups and watchables).
/// Mirrors: shared/content/src/models/view-object.ts → ViewObject
class ViewObject {
  String name = '';
  String logo = '';
  GroupObject? upperLevel;
  double logoPercent = 0.0;
  bool isSticky = false;
  DateTime? addedDate;

  /// Days since addedDate, e.g. "3 days ago." Empty string if no date.
  String get dateDiff {
    if (addedDate == null) return '';
    final days = DateTime.now().difference(addedDate!).inDays;
    return '$days days ago.';
  }

  bool get isHot => addedDate != null;

  String get title => 'Group';
}
