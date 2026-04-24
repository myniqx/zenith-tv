import 'package:flutter/material.dart';
import '../shared/client_section.dart';

class P2PPanelTv extends StatelessWidget {
  const P2PPanelTv({super.key});

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      padding: EdgeInsets.all(24),
      child: ClientSection(),
    );
  }
}
