import { useState, useEffect, useCallback } from 'react';
import {
  useSettingsStore,
  defaultKeyboardShortcuts,
} from '../../stores/settings';
import { ShortcutAction } from '@/types/types';
import { Button } from '@zenith-tv/ui/button';
import { Label } from '@zenith-tv/ui/label';
import { Separator } from '@zenith-tv/ui/separator';
import { RotateCcw, Play, Navigation, Tv, Subtitles, X } from 'lucide-react';

const shortcutLabels: Record<ShortcutAction, string> = {
  // Player controls
  playPause: 'Play / Pause',
  stop: 'Stop',
  seekForward: 'Seek Forward (+10s)',
  seekBackward: 'Seek Backward (-10s)',
  seekForwardSmall: 'Seek Forward (+3s)',
  seekBackwardSmall: 'Seek Backward (-3s)',
  volumeUp: 'Volume Up',
  volumeDown: 'Volume Down',
  toggleMute: 'Toggle Mute',

  // Screen modes
  toggleFullscreen: 'Toggle Fullscreen',
  exitFullscreen: 'Exit Fullscreen',
  stickyMode: 'Sticky Mode',
  freeScreenMode: 'Free Screen Mode',

  // Subtitle controls
  subtitleDelayPlus: 'Subtitle Delay (+100ms)',
  subtitleDelayMinus: 'Subtitle Delay (-100ms)',
  subtitleDisable: 'Disable Subtitles',
};

const playerShortcuts: ShortcutAction[] = [
  'playPause',
  'stop',
  'seekForward',
  'seekBackward',
  'seekForwardSmall',
  'seekBackwardSmall',
  'volumeUp',
  'volumeDown',
  'toggleMute',
];

const screenModeShortcuts: ShortcutAction[] = [
  'toggleFullscreen',
  'exitFullscreen',
  'stickyMode',
  'freeScreenMode',
];

const subtitleShortcuts: ShortcutAction[] = [
  'subtitleDelayPlus',
  'subtitleDelayMinus',
  'subtitleDisable',
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
      case 'escape':
        return 'Esc';
      case 'arrowup':
        return '↑';
      case 'arrowdown':
        return '↓';
      case 'arrowleft':
        return '←';
      case 'arrowright':
        return '→';
      case 'mousewheelup':
        return 'Wheel ↑';
      case 'mousewheeldown':
        return 'Wheel ↓';
      case 'mouseleft':
        return 'Mouse L';
      case 'mousemiddle':
        return 'Mouse M';
      case 'mouseright':
        return 'Mouse R';
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
  action: ShortcutAction;
  currentKeys: string[];
  isRecording: boolean;
  recordingSlot: number | null;
  onStartRecording: (slot: number) => void;
  onCancelRecording: () => void;
  onRemoveKey: (key: string) => void;
}

function ShortcutRow({
  action,
  currentKeys,
  isRecording,
  recordingSlot,
  onStartRecording,
  onCancelRecording,
  onRemoveKey,
}: ShortcutRowProps) {
  const hasSecondSlot = currentKeys.length >= 1;

  return (
    <div className="flex items-center justify-between py-2 gap-4">
      <Label className="text-sm flex-shrink-0 min-w-[180px]">{shortcutLabels[action]}</Label>
      <div className="flex items-center gap-2">
        {/* First key slot */}
        <div className="relative">
          <button
            onClick={isRecording && recordingSlot === 0 ? onCancelRecording : () => onStartRecording(0)}
            className={`
              min-w-[140px] px-3 py-1.5 text-sm font-mono rounded-md border transition-colors
              ${isRecording && recordingSlot === 0
                ? 'border-primary bg-primary/10 text-primary animate-pulse'
                : 'border-input bg-background hover:bg-muted'
              }
            `}
          >
            {isRecording && recordingSlot === 0
              ? 'Press a key...'
              : currentKeys[0]
                ? formatKeyDisplay(currentKeys[0])
                : 'Not set'}
          </button>
          {currentKeys[0] && !isRecording && (
            <button
              onClick={() => onRemoveKey(currentKeys[0])}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80"
              title="Remove key"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Second key slot */}
        <div className="relative">
          <button
            onClick={isRecording && recordingSlot === 1 ? onCancelRecording : () => onStartRecording(1)}
            className={`
              min-w-[140px] px-3 py-1.5 text-sm font-mono rounded-md border transition-colors
              ${isRecording && recordingSlot === 1
                ? 'border-primary bg-primary/10 text-primary animate-pulse'
                : hasSecondSlot
                  ? 'border-input bg-background hover:bg-muted'
                  : 'border-dashed border-input/50 bg-background/50 hover:bg-muted/50'
              }
            `}
          >
            {isRecording && recordingSlot === 1
              ? 'Press a key...'
              : currentKeys[1]
                ? formatKeyDisplay(currentKeys[1])
                : '+ Add alternative'}
          </button>
          {currentKeys[1] && !isRecording && (
            <button
              onClick={() => onRemoveKey(currentKeys[1])}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80"
              title="Remove key"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function KeyboardShortcuts() {
  const { keyboardShortcuts, addKeyToShortcut, removeKeyFromShortcut, resetKeyboardShortcuts } =
    useSettingsStore();

  const [recordingAction, setRecordingAction] = useState<ShortcutAction | null>(null);
  const [recordingSlot, setRecordingSlot] = useState<number | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!recordingAction || recordingSlot === null) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecordingAction(null);
        setRecordingSlot(null);
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

      // If recording slot 0, replace first key
      if (recordingSlot === 0) {
        const currentKeys = keyboardShortcuts[recordingAction] || [];
        const newKeys = currentKeys[1] ? [fullKey, currentKeys[1]] : [fullKey];

        // Remove from other actions
        Object.entries(keyboardShortcuts).forEach(([otherAction, keys]) => {
          if (otherAction !== recordingAction && keys.includes(fullKey)) {
            removeKeyFromShortcut(otherAction as ShortcutAction, fullKey);
          }
        });

        addKeyToShortcut(recordingAction, fullKey);
      }
      // If recording slot 1, add/replace second key
      else if (recordingSlot === 1) {
        // Remove from other actions first
        Object.entries(keyboardShortcuts).forEach(([otherAction, keys]) => {
          if (otherAction !== recordingAction && keys.includes(fullKey)) {
            removeKeyFromShortcut(otherAction as ShortcutAction, fullKey);
          }
        });

        addKeyToShortcut(recordingAction, fullKey);
      }

      setRecordingAction(null);
      setRecordingSlot(null);
    },
    [recordingAction, recordingSlot, keyboardShortcuts, addKeyToShortcut, removeKeyFromShortcut]
  );

  useEffect(() => {
    if (recordingAction && recordingSlot !== null) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [recordingAction, recordingSlot, handleKeyDown]);

  const hasChanges =
    JSON.stringify(keyboardShortcuts) !== JSON.stringify(defaultKeyboardShortcuts);

  const handleStartRecording = (action: ShortcutAction, slot: number) => {
    setRecordingAction(action);
    setRecordingSlot(slot);
  };

  const handleCancelRecording = () => {
    setRecordingAction(null);
    setRecordingSlot(null);
  };

  const handleRemoveKey = (action: ShortcutAction, key: string) => {
    removeKeyFromShortcut(action, key);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Click on a shortcut to change it. Press Escape to cancel. Each action can have up to 2 keys.
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
              currentKeys={keyboardShortcuts[action] || []}
              isRecording={recordingAction === action}
              recordingSlot={recordingAction === action ? recordingSlot : null}
              onStartRecording={(slot) => handleStartRecording(action, slot)}
              onCancelRecording={handleCancelRecording}
              onRemoveKey={(key) => handleRemoveKey(action, key)}
            />
          ))}
        </div>
      </section>

      <Separator />

      <section>
        <h4 className="text-md font-semibold mb-3 flex items-center gap-2">
          <Tv className="w-4 h-4" />
          Screen Modes
        </h4>
        <div className="space-y-1 bg-muted/30 rounded-lg p-3">
          {screenModeShortcuts.map((action) => (
            <ShortcutRow
              key={action}
              action={action}
              currentKeys={keyboardShortcuts[action] || []}
              isRecording={recordingAction === action}
              recordingSlot={recordingAction === action ? recordingSlot : null}
              onStartRecording={(slot) => handleStartRecording(action, slot)}
              onCancelRecording={handleCancelRecording}
              onRemoveKey={(key) => handleRemoveKey(action, key)}
            />
          ))}
        </div>
      </section>

      <Separator />

      <section>
        <h4 className="text-md font-semibold mb-3 flex items-center gap-2">
          <Subtitles className="w-4 h-4" />
          Subtitle Controls
        </h4>
        <div className="space-y-1 bg-muted/30 rounded-lg p-3">
          {subtitleShortcuts.map((action) => (
            <ShortcutRow
              key={action}
              action={action}
              currentKeys={keyboardShortcuts[action] || []}
              isRecording={recordingAction === action}
              recordingSlot={recordingAction === action ? recordingSlot : null}
              onStartRecording={(slot) => handleStartRecording(action, slot)}
              onCancelRecording={handleCancelRecording}
              onRemoveKey={(key) => handleRemoveKey(action, key)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
