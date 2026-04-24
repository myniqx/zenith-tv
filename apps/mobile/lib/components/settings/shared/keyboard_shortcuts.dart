import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../stores/settings_store.dart';

const _shortcutLabels = <ShortcutAction, String>{
  ShortcutAction.playPause:          'Play / Pause',
  ShortcutAction.stop:               'Stop',
  ShortcutAction.seekForward:        'Seek Forward (+10s)',
  ShortcutAction.seekBackward:       'Seek Backward (-10s)',
  ShortcutAction.seekForwardSmall:   'Seek Forward (+3s)',
  ShortcutAction.seekBackwardSmall:  'Seek Backward (-3s)',
  ShortcutAction.volumeUp:           'Volume Up',
  ShortcutAction.volumeDown:         'Volume Down',
  ShortcutAction.toggleMute:         'Toggle Mute',
  ShortcutAction.toggleFullscreen:   'Toggle Fullscreen',
  ShortcutAction.exitFullscreen:     'Exit Fullscreen',
  ShortcutAction.subtitleDelayPlus:  'Subtitle Delay (+100ms)',
  ShortcutAction.subtitleDelayMinus: 'Subtitle Delay (-100ms)',
  ShortcutAction.subtitleDisable:    'Disable Subtitles',
};

const _playerActions = [
  ShortcutAction.playPause,
  ShortcutAction.stop,
  ShortcutAction.seekForward,
  ShortcutAction.seekBackward,
  ShortcutAction.seekForwardSmall,
  ShortcutAction.seekBackwardSmall,
  ShortcutAction.volumeUp,
  ShortcutAction.volumeDown,
  ShortcutAction.toggleMute,
];

const _screenActions = [
  ShortcutAction.toggleFullscreen,
  ShortcutAction.exitFullscreen,
];

const _subtitleActions = [
  ShortcutAction.subtitleDelayPlus,
  ShortcutAction.subtitleDelayMinus,
  ShortcutAction.subtitleDisable,
];

class KeyboardShortcutsSettings extends StatefulWidget {
  const KeyboardShortcutsSettings({super.key});

  @override
  State<KeyboardShortcutsSettings> createState() =>
      _KeyboardShortcutsSettingsState();
}

class _KeyboardShortcutsSettingsState
    extends State<KeyboardShortcutsSettings> {
  ShortcutAction? _recordingAction;
  int? _recordingSlot;

  void _startRecording(ShortcutAction action, int slot) {
    setState(() {
      _recordingAction = action;
      _recordingSlot = slot;
    });
  }

  void _cancelRecording() {
    setState(() {
      _recordingAction = null;
      _recordingSlot = null;
    });
  }

  KeyEventResult _handleKey(FocusNode node, KeyEvent event) {
    if (_recordingAction == null || _recordingSlot == null) {
      return KeyEventResult.ignored;
    }
    if (event is! KeyDownEvent) return KeyEventResult.ignored;

    if (event.logicalKey == LogicalKeyboardKey.escape) {
      _cancelRecording();
      return KeyEventResult.handled;
    }

    // Skip bare modifier keys
    if ([
      LogicalKeyboardKey.control,
      LogicalKeyboardKey.alt,
      LogicalKeyboardKey.shift,
      LogicalKeyboardKey.meta,
    ].contains(event.logicalKey)) {
      return KeyEventResult.ignored;
    }

    final modifiers = <String>[];
    final hw = HardwareKeyboard.instance;
    if (hw.isControlPressed) modifiers.add('ctrl');
    if (hw.isAltPressed) modifiers.add('alt');
    if (hw.isShiftPressed) modifiers.add('shift');
    if (hw.isMetaPressed) modifiers.add('meta');

    final keyLabel = event.logicalKey.keyLabel.isNotEmpty
        ? event.logicalKey.keyLabel
        : event.logicalKey.debugName ?? 'Unknown';

    final fullKey = [...modifiers, keyLabel].join('+');
    context.read<SettingsStore>().addKeyToShortcut(_recordingAction!, fullKey);
    _cancelRecording();
    return KeyEventResult.handled;
  }

  @override
  Widget build(BuildContext context) {
    final store = context.watch<SettingsStore>();
    final hasChanges = store.keyboardShortcuts
            .toString() !=
        defaultKeyboardShortcuts.toString();

    return Focus(
      autofocus: true,
      onKeyEvent: _handleKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Click on a shortcut to change it. Press Escape to cancel.',
                  style: ZText.body(12, color: ZColors.mutedForeground),
                ),
              ),
              if (hasChanges)
                TextButton.icon(
                  onPressed: store.resetKeyboardShortcuts,
                  icon: const Icon(Icons.refresh, size: 14),
                  label: const Text('Reset All'),
                ),
            ],
          ),
          const SizedBox(height: 16),
          _ShortcutGroup(
            title: 'Player Controls',
            icon: Icons.play_circle_outline,
            actions: _playerActions,
            shortcuts: store.keyboardShortcuts,
            recordingAction: _recordingAction,
            recordingSlot: _recordingSlot,
            onStartRecording: _startRecording,
            onCancelRecording: _cancelRecording,
            onRemoveKey: store.removeKeyFromShortcut,
          ),
          const SizedBox(height: 16),
          _ShortcutGroup(
            title: 'Screen Modes',
            icon: Icons.fullscreen,
            actions: _screenActions,
            shortcuts: store.keyboardShortcuts,
            recordingAction: _recordingAction,
            recordingSlot: _recordingSlot,
            onStartRecording: _startRecording,
            onCancelRecording: _cancelRecording,
            onRemoveKey: store.removeKeyFromShortcut,
          ),
          const SizedBox(height: 16),
          _ShortcutGroup(
            title: 'Subtitle Controls',
            icon: Icons.subtitles_outlined,
            actions: _subtitleActions,
            shortcuts: store.keyboardShortcuts,
            recordingAction: _recordingAction,
            recordingSlot: _recordingSlot,
            onStartRecording: _startRecording,
            onCancelRecording: _cancelRecording,
            onRemoveKey: store.removeKeyFromShortcut,
          ),
        ],
      ),
    );
  }
}

class _ShortcutGroup extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<ShortcutAction> actions;
  final Map<ShortcutAction, List<String>> shortcuts;
  final ShortcutAction? recordingAction;
  final int? recordingSlot;
  final void Function(ShortcutAction, int) onStartRecording;
  final VoidCallback onCancelRecording;
  final void Function(ShortcutAction, String) onRemoveKey;

  const _ShortcutGroup({
    required this.title,
    required this.icon,
    required this.actions,
    required this.shortcuts,
    required this.recordingAction,
    required this.recordingSlot,
    required this.onStartRecording,
    required this.onCancelRecording,
    required this.onRemoveKey,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 14, color: ZColors.mutedForeground),
            const SizedBox(width: 6),
            Text(title, style: ZText.body(13, weight: FontWeight.w600)),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: ZColors.secondary,
            borderRadius: BorderRadius.circular(10),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Column(
            children: [
              for (int i = 0; i < actions.length; i++) ...[
                _ShortcutRow(
                  action: actions[i],
                  keys: shortcuts[actions[i]] ?? [],
                  isRecording: recordingAction == actions[i],
                  recordingSlot:
                      recordingAction == actions[i] ? recordingSlot : null,
                  onStartRecording: (slot) =>
                      onStartRecording(actions[i], slot),
                  onCancelRecording: onCancelRecording,
                  onRemoveKey: (key) => onRemoveKey(actions[i], key),
                ),
                if (i < actions.length - 1)
                  Divider(
                      height: 1,
                      color: ZColors.border.withValues(alpha: 0.15)),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _ShortcutRow extends StatelessWidget {
  final ShortcutAction action;
  final List<String> keys;
  final bool isRecording;
  final int? recordingSlot;
  final void Function(int slot) onStartRecording;
  final VoidCallback onCancelRecording;
  final void Function(String key) onRemoveKey;

  const _ShortcutRow({
    required this.action,
    required this.keys,
    required this.isRecording,
    required this.recordingSlot,
    required this.onStartRecording,
    required this.onCancelRecording,
    required this.onRemoveKey,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(_shortcutLabels[action] ?? action.name,
                style: ZText.body(13)),
          ),
          Row(
            children: [
              _KeySlot(
                keyLabel: keys.isNotEmpty ? keys[0] : null,
                isRecording: isRecording && recordingSlot == 0,
                onTap: isRecording && recordingSlot == 0
                    ? onCancelRecording
                    : () => onStartRecording(0),
                onRemove: keys.isNotEmpty ? () => onRemoveKey(keys[0]) : null,
              ),
              const SizedBox(width: 6),
              _KeySlot(
                keyLabel: keys.length > 1 ? keys[1] : null,
                isRecording: isRecording && recordingSlot == 1,
                isAlternate: true,
                onTap: isRecording && recordingSlot == 1
                    ? onCancelRecording
                    : () => onStartRecording(1),
                onRemove:
                    keys.length > 1 ? () => onRemoveKey(keys[1]) : null,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _KeySlot extends StatelessWidget {
  final String? keyLabel;
  final bool isRecording;
  final bool isAlternate;
  final VoidCallback onTap;
  final VoidCallback? onRemove;

  const _KeySlot({
    required this.onTap,
    this.keyLabel,
    this.isRecording = false,
    this.isAlternate = false,
    this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        GestureDetector(
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            constraints: const BoxConstraints(minWidth: 110),
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: isRecording
                  ? ZColors.primary.withValues(alpha: 0.15)
                  : ZColors.muted,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: isRecording
                    ? ZColors.primary
                    : isAlternate && keyLabel == null
                        ? ZColors.border.withValues(alpha: 0.3)
                        : ZColors.border.withValues(alpha: 0.5),
                style: isAlternate && keyLabel == null
                    ? BorderStyle.solid
                    : BorderStyle.solid,
              ),
            ),
            child: Text(
              isRecording
                  ? 'Press a key...'
                  : keyLabel ?? (isAlternate ? '+ Add alt' : 'Not set'),
              style: ZText.body(11,
                  color: isRecording
                      ? ZColors.primary
                      : keyLabel != null
                          ? ZColors.foreground
                          : ZColors.mutedForeground),
              textAlign: TextAlign.center,
            ),
          ),
        ),
        if (onRemove != null && !isRecording)
          Positioned(
            top: -6, right: -6,
            child: GestureDetector(
              onTap: onRemove,
              child: Container(
                width: 16, height: 16,
                decoration: const BoxDecoration(
                  color: ZColors.destructive,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.close,
                    size: 10, color: ZColors.destructiveFg),
              ),
            ),
          ),
      ],
    );
  }
}
