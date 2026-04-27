import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('placeholder', (WidgetTester tester) async {
    // Zenith TV app requires MediaKit.ensureInitialized() and native plugins
    // before it can be pumped in a widget test. Integration tests live in
    // integration_test/ instead.
    expect(true, isTrue);
  });
}
