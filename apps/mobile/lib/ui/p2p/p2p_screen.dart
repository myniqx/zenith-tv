import 'package:flutter/material.dart';
import '../../core/app_theme.dart';
import '../../components/p2p/p2p_panel.dart';

class P2PScreen extends StatelessWidget {
  const P2PScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ZColors.background,
      appBar: AppBar(title: const Text('Remote Control')),
      body: const P2PPanel(),
    );
  }
}
