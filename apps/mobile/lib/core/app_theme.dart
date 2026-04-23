import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// ── Color Tokens ─────────────────────────────────────────────────────────────
class ZColors {
  // Surface hierarchy (design: "stacked sheets of obsidian")
  static const background = Color(0xFF0E0E0E);   // OLED void base
  static const muted      = Color(0xFF131313);   // large sidebars
  static const secondary  = Color(0xFF262626);   // cards, modals (lifted)
  static const card       = Color(0xFF000000);   // behind posters

  // Primary accent — electric lavender
  static const primary            = Color(0xFFB6A0FF);
  static const primaryDim         = Color(0xFF7E51FF); // ring / active states
  static const primaryForeground  = Color(0xFF000000);

  // Accent — secondary-container (focus fills)
  static const accent             = Color(0xFF2E2650); // purple-tinted dark

  // Text
  static const foreground         = Color(0xFFFFFFFF);
  static const mutedForeground    = Color(0xFFADAAAA);

  // Ghost border (always used at low opacity)
  static const border             = Color(0xFF494847);

  // Semantic
  static const destructive        = Color(0xFF4D1F1F);
  static const destructiveFg      = Color(0xFFFCA5A5);
  static const success            = Color(0xFF1A3D2A);
  static const successFg          = Color(0xFF86EFAC);
  static const warning            = Color(0xFF3D2E0A);
  static const warningFg          = Color(0xFFFCD34D);
  static const info               = Color(0xFF0F2A3D);
  static const infoFg             = Color(0xFF7DD3FC);
}

// ── Text Styles ───────────────────────────────────────────────────────────────
class ZText {
  static TextStyle headline(double size, {FontWeight weight = FontWeight.w900}) =>
      GoogleFonts.spaceGrotesk(fontSize: size, fontWeight: weight, color: ZColors.foreground);

  static TextStyle body(double size, {FontWeight weight = FontWeight.w400, Color? color}) =>
      GoogleFonts.manrope(fontSize: size, fontWeight: weight, color: color ?? ZColors.foreground);

  // Presets
  static final displayLg  = headline(32, weight: FontWeight.w900);
  static final headlineMd = headline(22, weight: FontWeight.w800);
  static final headlineSm = headline(16, weight: FontWeight.w700);
  static final titleLg    = body(16, weight: FontWeight.w600);
  static final bodyMd     = body(14);
  static final bodySm     = body(12, color: ZColors.mutedForeground);
  static final label      = body(11, weight: FontWeight.w700, color: ZColors.mutedForeground);
  static final labelUpper = GoogleFonts.spaceGrotesk(
    fontSize: 11, fontWeight: FontWeight.w700,
    letterSpacing: 1.2, color: ZColors.mutedForeground,
  );
}

// ── Theme ─────────────────────────────────────────────────────────────────────
ThemeData buildAppTheme() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: ZColors.background,
    colorScheme: const ColorScheme.dark(
      primary:          ZColors.primary,
      onPrimary:        ZColors.primaryForeground,
      secondary:        ZColors.secondary,
      onSecondary:      ZColors.foreground,
      surface:          ZColors.muted,
      onSurface:        ZColors.foreground,
      error:            ZColors.destructive,
      onError:          ZColors.destructiveFg,
      outline:          ZColors.border,
      surfaceContainerHighest: ZColors.secondary,
    ),
    textTheme: GoogleFonts.manropeTextTheme(ThemeData.dark().textTheme).copyWith(
      displayLarge:   ZText.headline(32),
      headlineLarge:  ZText.headline(26),
      headlineMedium: ZText.headline(22),
      titleLarge:     ZText.body(16, weight: FontWeight.w600),
      titleMedium:    ZText.body(14, weight: FontWeight.w600),
      bodyLarge:      ZText.body(16),
      bodyMedium:     ZText.body(14),
      bodySmall:      ZText.body(12, color: ZColors.mutedForeground),
      labelSmall:     ZText.labelUpper,
    ),
    // Cards
    cardTheme: const CardThemeData(
      color: ZColors.secondary,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
      ),
    ),
    // AppBar
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: ZText.headline(20),
      iconTheme: const IconThemeData(color: ZColors.foreground),
    ),
    // Divider — tonal, no hard lines
    dividerTheme: const DividerThemeData(
      color: Color(0x33494847), // border at ~20% opacity
      thickness: 1,
      space: 0,
    ),
    // Input fields
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: ZColors.secondary,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0x33494847)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0x33494847)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: ZColors.primary, width: 1.5),
      ),
      hintStyle: ZText.body(14, color: ZColors.mutedForeground),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    // Elevated / filled buttons
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: ZColors.primary,
        foregroundColor: ZColors.primaryForeground,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        textStyle: ZText.body(14, weight: FontWeight.w700),
      ),
    ),
    // Outlined buttons
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: ZColors.foreground,
        side: const BorderSide(color: Color(0x4D494847)),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        textStyle: ZText.body(14, weight: FontWeight.w600),
      ),
    ),
    // Text buttons
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: ZColors.primary,
        textStyle: ZText.body(14, weight: FontWeight.w600),
      ),
    ),
    // Chips
    chipTheme: ChipThemeData(
      backgroundColor: ZColors.muted,
      selectedColor: ZColors.accent,
      labelStyle: ZText.body(12, weight: FontWeight.w600),
      side: BorderSide.none,
      shape: const StadiumBorder(),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    ),
    // Bottom nav
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: ZColors.muted,
      selectedItemColor: ZColors.primary,
      unselectedItemColor: ZColors.mutedForeground,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
    // Progress indicator
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: ZColors.primary,
    ),
    // Switch
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) =>
          s.contains(WidgetState.selected) ? ZColors.primaryForeground : ZColors.mutedForeground),
      trackColor: WidgetStateProperty.resolveWith((s) =>
          s.contains(WidgetState.selected) ? ZColors.primary : ZColors.secondary),
      trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
    ),
    // Dialog
    dialogTheme: DialogThemeData(
      backgroundColor: ZColors.secondary,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      titleTextStyle: ZText.headline(18),
      contentTextStyle: ZText.body(14),
    ),
    // Snackbar
    snackBarTheme: SnackBarThemeData(
      backgroundColor: ZColors.secondary,
      contentTextStyle: ZText.body(14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      behavior: SnackBarBehavior.floating,
    ),
  );
}
