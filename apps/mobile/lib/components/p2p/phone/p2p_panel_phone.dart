import 'package:flutter/material.dart';
import '../shared/server_section.dart';

class P2PPanelPhone extends StatelessWidget {
  const P2PPanelPhone({super.key});

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      padding: EdgeInsets.all(16),
      child: ServerSection(),
    );
  }
}
