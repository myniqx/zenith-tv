import { useState, useEffect, useCallback } from 'react';
import {
  useSettingsStore,
  defaultKeyboardShortcuts,
  type KeyboardShortcuts as KeyboardShortcutsType,
} from '../stores/settings';
import { Button } from '@zenith-tv/ui/button';
import { Label } from '@zenith-tv/ui/label';
import { Separator } from '@zenith-tv/ui/separator';
import { RotateCcw, Play, Navigation } from 'lucide-react';

const shortcutLabels: Record<keyof KeyboardShortcutsType, string> = {
  playPause: 'Play / Pause',
  seekForward: 'Seek Forward (+10s)',
  seekBackward: 'Seek Backward (-10s)',
  volumeUp: 'Volume Up',
  volumeDown: 'Volume Down',
  toggleMute: 'Toggle Mute',
  toggleFullscreen: 'Toggle Fullscreen',
  openSearch: 'Open Search',
  openSettings: 'Open Settings',
  openProfileManager: 'Open Profile Manager',
};

const playerShortcuts: (keyof KeyboardShortcutsType)[] = [
  'playPause',
  'seekForward',
  'seekBackward',
  'volumeUp',
  'volumeDown',
  'toggleMute',
  'toggleFullscreen',
];

const navigationShortcuts: (keyof KeyboardShortcutsType)[] = [
  'openSearch',
  'openSettings',
  'openProfileManager',
];

function formatKeyDisplay(key: string): string {
  const parts = key.split('+');
  const formattedParts = parts.map((part) => {
    switch (part.toLowerCase()) {
      case 'ctrl':
        return 'Ctrl';
      case 'alt':
        return 'Alt';
      case 'shift':
        return 'Shift';
      case 'meta':
        return 'Win';
      case 'space':
        return 'Space';
      case 'arrowup':
        return '\u2191';
      case 'arrowdown':
        return '\u2193';
      case 'arrowleft':
        return '\u2190';
      case 'arrowright':
        return '\u2192';
      default:
        if (part.startsWith('Key')) {
          return part.slice(3);
        }
        if (part.startsWith('Digit')) {
          return part.slice(5);
        }
        return part;
    }
  });
  return formattedParts.join(' + ');
}

interface ShortcutRowProps {
  action: keyof KeyboardShortcutsType;
  currentKey: string;
  isRecording: boolean;
  onStartRecording: () => void;
  onCancelRecording: () => void;
}

function ShortcutRow({
  action,
  currentKey,
  isRecording,
  onStartRecording,
  onCancelRecording,
}: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <Label className="text-sm">{shortcutLabels[action]}</Label>
      <button
        onClick={isRecording ? onCancelRecording : onStartRecording}
        className={`
          min-w-[120px] px-3 py-1.5 text-sm font-mono rounded-md border transition-colors
          ${
            isRecording
              ? 'border-primary bg-primary/10 text-primary animate-pulse'
              : 'border-input bg-background hover:bg-muted'
          }
        `}
      >
        {isRecording ? 'Press a key...' : formatKeyDisplay(currentKey)}
      </button>
    </div>
  );
}

export function KeyboardShortcuts() {
  const { keyboardShortcuts, setKeyboardShortcut, resetKeyboardShortcuts } =
    useSettingsStore();

  const [recordingAction, setRecordingAction] = useState<keyof KeyboardShortcutsType | null>(
    null
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!recordingAction) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecordingAction(null);
        return;
      }

      const modifiers: string[] = [];
      if (e.ctrlKey) modifiers.push('ctrl');
      if (e.altKey) modifiers.push('alt');
      if (e.shiftKey) modifiers.push('shift');
      if (e.metaKey) modifiers.push('meta');

      let key = e.code;

      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        return;
      }

      const fullKey = [...modifiers, key].join('+');

      setKeyboardShortcut(recordingAction, fullKey);
      setRecordingAction(null);
    },
    [recordingAction, setKeyboardShortcut]
  );

  useEffect(() => {
    if (recordingAction) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [recordingAction, handleKeyDown]);

  const hasChanges =
    JSON.stringify(keyboardShortcuts) !== JSON.stringify(defaultKeyboardShortcuts);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Click on a shortcut to change it. Press Escape to cancel.
        </p>
        {hasChanges && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetKeyboardShortcuts}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset All
          </Button>
        )}
      </div>

      <section>
        <h4 className="text-md font-semibold mb-3 flex items-center gap-2">
          <Play className="w-4 h-4" />
          Player Controls
        </h4>
        <div className="space-y-1 bg-muted/30 rounded-lg p-3">
          {playerShortcuts.map((action) => (
            <ShortcutRow
              key={action}
              action={action}
              currentKey={keyboardShortcuts[action]}
              isRecording={recordingAction === action}
              onStartRecording={() => setRecordingAction(action)}
              onCancelRecording={() => setRecordingAction(null)}
            />
          ))}
        </div>
      </section>

      <Separator />

      <section>
        <h4 className="text-md font-semibold mb-3 flex items-center gap-2">
          <Navigation className="w-4 h-4" />
          Navigation
        </h4>
        <div className="space-y-1 bg-muted/30 rounded-lg p-3">
          {navigationShortcuts.map((action) => (
            <ShortcutRow
              key={action}
              action={action}
              currentKey={keyboardShortcuts[action]}
              isRecording={recordingAction === action}
              onStartRecording={() => setRecordingAction(action)}
              onCancelRecording={() => setRecordingAction(null)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
