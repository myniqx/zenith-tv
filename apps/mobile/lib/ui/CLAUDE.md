# UI Layer — Flutter Development Guide

This document defines the conventions, architecture decisions, and design rules for the Flutter UI layer. Read this before touching any file under `lib/ui/`.

---

## Why Three Layouts?

Zenith TV targets three fundamentally different form factors, each with different interaction models and P2P roles:

| Device | Interaction | P2P Role | Navigation |
|--------|-------------|----------|------------|
| **Phone** | Touch, small screen | Server only (remote control) | Bottom nav bar |
| **Tablet** | Touch, large screen | Server + Client | Top header |
| **TV** | D-pad / remote control | Client only (video player) | Top header + focus system |

A single layout cannot serve all three. A phone UI with a bottom nav bar looks wrong on a TV; a TV UI with large focusable tiles is unusable on a phone. The device is detected at startup via `DeviceTypeDetector` in `core/device_type.dart`.

---

## Folder Structure

### Screens (`ui/`)

Full-page views. Every screen follows this pattern:

```
ui/
  <screen>/
    <screen>_screen.dart        ← Router only. Reads DeviceTypeDetector, returns the correct layout.
    shared/
      <shared_widget>.dart      ← Widgets used by more than one layout variant.
    phone/
      <screen>_screen_phone.dart
      <child_widget>.dart       ← Phone-specific child widgets.
    tablet/
      <screen>_screen_tablet.dart
      <child_widget>.dart
    tv/
      <screen>_screen_tv.dart
      <child_widget>.dart       ← TV-specific child widgets (must use TvFocusable).
```

### Components (`components/`)

Reusable UI widgets used by multiple screens. Components also follow the same platform pattern:

```
components/
  <component>/
    <component>.dart             ← Router only. Switches on DeviceTypeDetector.
    shared/
      <shared_widget>.dart       ← Widgets shared across platform variants.
    phone/
      <component>_phone.dart
    tablet/
      <component>_tablet.dart
    tv/
      <component>_tv.dart
```

**Examples:** `category_browser`, `toolbar`, `content_grid`, `video_controller`

### Shell (`ui/shell/`)

Layout skeletons — navigation structure, panel arrangement, header. Not a "screen" but follows the same platform split:

```
ui/shell/
  app_shell.dart                 ← Router only (DeviceType switch, no UI)
  app_section.dart               ← AppSection enum (shared across all shells)
  phone/app_shell_phone.dart
  tablet/app_shell_tablet.dart
  tv/app_shell_tv.dart
```

**Rules:**
- The router file (`<screen>_screen.dart` or `<component>.dart`) contains **no UI code** — only a switch on `DeviceTypeDetector`.
- Each layout variant is a self-contained widget in its own file.
- Child widgets that are **only used in one layout** live in that layout's folder.
- Child widgets **shared across layouts** live in `shared/`.
- Never put all widgets for a screen into a single file. One logical component = one file.
- `AppSection` enum lives in `ui/shell/app_section.dart` — import from there, never re-declare.

---

## Color & Style Rules

All colors and text styles come from `core/app_theme.dart`. **Never hardcode a color value.**

```dart
// ✅ Correct
color: ZColors.primary
color: ZColors.mutedForeground
color: ZColors.border.withValues(alpha: 0.2)
style: ZText.body(14, weight: FontWeight.w600)
style: ZText.headline(22)

// ❌ Wrong
color: const Color(0xFFEF4444)
color: Colors.red
color: Colors.grey.shade600
style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8))
```

**Token reference (`ZColors`):**

| Token | Role |
|-------|------|
| `background` | OLED base — page backgrounds |
| `muted` | Sidebars, secondary regions |
| `secondary` | Cards, modals — "lifted" surface |
| `card` | Behind posters |
| `primary` | Electric lavender — focus, CTA |
| `primaryDim` | Active/pressed states |
| `accent` | Focus fill for ghost buttons |
| `border` | Always use at low opacity (`withValues(alpha: 0.15–0.4)`) |
| `mutedForeground` | Secondary text |
| `destructiveFg` | Error text and icons |
| `successFg` | Success indicators |

**No hard borders.** Structure is defined through tonal shifts, not `Border` dividers. When a separator is absolutely necessary, use `ZColors.border.withValues(alpha: 0.2)` — never full opacity.

---

## Typography Rules

```dart
ZText.headline(size)      // Space Grotesk — titles, screen headers
ZText.headlineSm          // Space Grotesk 16px bold — card titles
ZText.body(size)          // Manrope — body text, labels
ZText.bodySm              // Manrope 12px muted — secondary info
ZText.labelUpper          // Space Grotesk 11px uppercase tracking — section headers
```

Section headers (like "CATEGORIES") always use `ZText.labelUpper`. Screen titles use `ZText.headline(...)`. Never use raw `TextStyle(...)` unless you need a one-off weight override on top of a `ZText` style.

---

## Surface Hierarchy

Treat the UI as stacked sheets of obsidian. Three levels only — never nest deeper:

1. `ZColors.background` — the void. Page scaffolds.
2. `ZColors.muted` — sidebars, secondary regions.
3. `ZColors.secondary` — cards, modals, list items.

A `secondary` card on a `background` page looks "lifted." A `muted` sidebar on a `background` page defines the boundary through color alone — no border needed.

---

## TV Navigation System

TV users navigate exclusively with a D-pad. Touch events do not exist. Every interactive element in a TV layout **must** be wrapped in a `TvFocusable` from `core/tv_focus.dart`.

### Available Widgets (`core/tv_focus.dart`)

| Widget | navix equivalent | Use for |
|--------|-----------------|---------|
| `TvFocusable` | `Button` | Any custom focusable element |
| `TvButton` | — | Standard labeled button with icon |
| `TvVerticalList` | `VerticalList` | Vertical scrollable focus group |
| `TvHorizontalList` | `HorizontalList` | Row of focusable items |
| `TvGrid` | `PaginatedGrid` | Grid with d-pad navigation |
| `TvFocusScope` | `FocusRoot` | Screen-level focus isolation |

### How Focus Works

- `TvFocusable` wraps any widget. It gives it a `FocusNode`, handles `enter`/`select` key events, and applies a `scale 0.95 → 1.0` animation on focus gain.
- The `builder` callback receives `(context, focused)` — use `focused` to apply `ZColors.accent` background and `ZColors.primary` text/icon color.
- `TvVerticalList` and `TvHorizontalList` use `FocusTraversalGroup` with `OrderedTraversalPolicy` — focus moves in document order within the group.
- Every TV screen's root widget must be wrapped in `TvFocusScope` for proper isolation between screens.

### Focus State Styling Convention

```dart
TvFocusable(
  onSelect: onTap,
  builder: (context, focused) => Container(
    decoration: BoxDecoration(
      color: focused ? ZColors.accent : Colors.transparent,
      borderRadius: BorderRadius.circular(999),
      border: Border.all(
        color: focused
            ? ZColors.primary.withValues(alpha: 0.5)
            : Colors.transparent,
      ),
    ),
    child: Text(
      label,
      style: ZText.body(14, weight: FontWeight.w600,
          color: focused ? ZColors.primary : ZColors.mutedForeground),
    ),
  ),
),
```

**Focus rules:**
- Unfocused rest state: `scale(0.95)`, muted colors, transparent background.
- Focused state: `scale(1.0)`, `ZColors.accent` fill, `ZColors.primary` text/icon.
- Destructive actions (delete): focused state uses `ZColors.destructive` fill + `ZColors.destructiveFg` text.
- Never use `Colors.blue`, `Colors.green`, or any hardcoded color for focus states.

---

## Tizen Design Parity (TV Layout)

The TV layout must closely match the Tizen app (`apps/tizen/`) in visual language. Refer to `apps/tizen/design.md` for the full spec. Key rules:

- **Screen titles**: `ZText.headline(28)`, italic optional for brand text ("Zenith TV").
- **Cards**: `ZColors.secondary` background, `BorderRadius.circular(12–16)`, ghost border at 15% opacity.
- **Profile cards**: Avatar circle + username + active badge row at top; action buttons in `TvHorizontalList` at bottom-right — matches `ProfileCard.tsx` in Tizen.
- **Section headers**: `ZText.labelUpper` (uppercase, wide tracking) — matches `text-xs font-bold uppercase tracking-widest` in Tizen.
- **Add/New buttons**: Dashed-style outlined button, full width, centered icon+label — matches the `Expandable` "Yeni Profil" trigger in Tizen.
- **Overlays/Modals**: Full-screen `Colors.black.withValues(alpha: 0.75)` backdrop + centered `ZColors.secondary` container with `BorderRadius.circular(20)` — matches Tizen's `fixed inset-0 bg-black/70 backdrop-blur-sm`.
- **List spacing**: 16px between cards (`margin bottom`), 24–32px horizontal padding on TV screens, 48px top/bottom padding.

---

## Phone & Tablet Conventions

- Phone layouts use `Scaffold` with `AppBar` and `SingleChildScrollView`.
- Tablet layouts use `Scaffold` with `AppBar` (no bottom nav — top header is in `AppShell`).
- Touch targets: minimum 48×48px (`ElevatedButton`, `TextButton` default sizing is fine).
- Buttons use theme defaults — `ElevatedButton` for primary actions, `OutlinedButton` for secondary, `TextButton` for destructive or inline actions.
- Forms use `InputDecoration` from the theme — never override `fillColor`, `border`, or `hintStyle` inline.

---

## What NOT to Do

- **Don't put multiple unrelated widgets in one file.** If a widget has its own state or is longer than ~80 lines, split it out.
- **Don't use `isTV` flags in shared widgets.** If behavior differs between TV and non-TV, create separate TV and non-TV implementations instead of branching inside a shared widget.
- **Don't add `GestureDetector` or `InkWell` to TV layout widgets.** Use `TvFocusable` — touch events won't fire on a TV remote anyway.
- **Don't nest more than 3 surface levels.** `background` → `muted` → `secondary` is the maximum.
- **Don't import TV-specific widgets (`TvFocusable`, etc.) in phone or tablet files.** Keep the dependency graph clean.
