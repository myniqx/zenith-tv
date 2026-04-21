import { Play, Pause, SkipBack, SkipForward, Square } from 'lucide-react'
import { Button, HorizontalList, VerticalList } from '@navix/react'
import { cn } from '@zenith-tv/ui/lib'
import type { MultiLayerPanelProps } from '@navix/react'

interface ControlPanelProps extends MultiLayerPanelProps {
  paused: boolean
  position: number
  duration: number
  onPlayPause: () => void
  onSeek: (seconds: number) => void
  onStop: () => void
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ControlPanel({ fKey, paused, position, duration, onPlayPause, onSeek, onStop }: ControlPanelProps) {
  const progress = duration > 0 ? Math.min((position / duration) * 100, 100) : 0

  return (
    <div className={cn(
      'absolute inset-x-0 bottom-0 px-16 py-10',
      'bg-gradient-to-t from-black/90 via-black/60 to-transparent',
      'backdrop-blur-sm',
    )}>
      <VerticalList fKey={fKey}>
        {/* seek bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-foreground tabular-nums">
              {formatTime(position)}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
          <div className="relative h-1 bg-border/30 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* controls */}
        <HorizontalList fKey={`${fKey}-controls`}>
          <div className="flex items-center justify-center gap-4">
            <Button fKey={`${fKey}-back10`} onClick={() => onSeek(Math.max(0, position - 10))}>
              {({ focused }) => (
                <div className={cn(
                  'flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200',
                  focused ? 'bg-accent text-primary scale-110' : 'text-muted-foreground',
                )}>
                  <SkipBack className="w-5 h-5" />
                </div>
              )}
            </Button>

            <Button fKey={`${fKey}-playpause`} onClick={onPlayPause}>
              {({ focused }) => (
                <div className={cn(
                  'flex items-center justify-center w-16 h-16 rounded-full transition-all duration-200',
                  focused
                    ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/30'
                    : 'bg-secondary text-foreground',
                )}>
                  {paused
                    ? <Play className="w-7 h-7 translate-x-0.5" />
                    : <Pause className="w-7 h-7" />
                  }
                </div>
              )}
            </Button>

            <Button fKey={`${fKey}-forward10`} onClick={() => onSeek(position + 10)}>
              {({ focused }) => (
                <div className={cn(
                  'flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200',
                  focused ? 'bg-accent text-primary scale-110' : 'text-muted-foreground',
                )}>
                  <SkipForward className="w-5 h-5" />
                </div>
              )}
            </Button>

            <Button fKey={`${fKey}-stop`} onClick={onStop}>
              {({ focused }) => (
                <div className={cn(
                  'flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200',
                  focused ? 'bg-destructive/20 text-destructive scale-110' : 'text-muted-foreground/50',
                )}>
                  <Square className="w-4 h-4" />
                </div>
              )}
            </Button>
          </div>
        </HorizontalList>
      </VerticalList>
    </div>
  )
}
