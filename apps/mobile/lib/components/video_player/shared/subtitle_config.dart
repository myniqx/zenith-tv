import 'package:flutter/material.dart';
import 'package:media_kit_video/media_kit_video.dart';
import '../../../stores/settings_store.dart';

SubtitleViewConfiguration buildSubtitleConfig(SettingsStore settings) {
  return SubtitleViewConfiguration(
    style: TextStyle(
      height: 1.4,
      fontSize: settings.subtitleFontSize,
      color: Color(settings.subtitleTextColor),
      backgroundColor: Color(settings.subtitleBgColor),
      fontWeight:
          settings.subtitleBold ? FontWeight.bold : FontWeight.normal,
    ),
    textAlign: switch (settings.subtitleTextAlign) {
      'left'  => TextAlign.left,
      'right' => TextAlign.right,
      _       => TextAlign.center,
    },
    padding: const EdgeInsets.all(24.0),
  );
}
