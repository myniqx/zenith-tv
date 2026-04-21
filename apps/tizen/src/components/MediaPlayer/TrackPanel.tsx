import { Volume2, Subtitles } from 'lucide-react'
import { Button, VerticalList, HorizontalList } from '@navix/react'
import { cn } from '@zenith-tv/ui/lib'
import type { MultiLayerPanelProps } from '@navix/react'

interface Track {
  index: number
  language: string
  label?: string
}

interface TrackPanelProps extends MultiLayerPanelProps {
  audioTracks: Track[]
  subtitleTracks: Track[]
  currentAudio: number
  currentSubtitle: number
  onSelectAudio: (index: number) => void
  onSelectSubtitle: (index: number) => void
}

function TrackList({
  fKey,
  tracks,
  current,
  onSelect,
}: {
  fKey: string
  tracks: Track[]
  current: number
  onSelect: (index: number) => void
}) {
  if (tracks.length === 0) {
    return <p className="text-xs text-muted-foreground/50 px-2 py-1">Track bulunamadı</p>
  }

  return (
    <VerticalList fKey={fKey}>
      <div className="space-y-1">
        {tracks.map((track) => {
          const isActive = track.index === current
          return (
            <Button
              key={track.index}
              fKey={`${fKey}-${track.index}`}
              onClick={() => onSelect(track.index)}
            >
              {({ focused }) => (
                <div className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200',
                  focused ? 'bg-accent' : isActive ? 'bg-primary/10' : 'bg-transparent',
                )}>
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-200',
                    isActive ? 'bg-primary' : 'bg-transparent',
                  )} />
                  <span className={cn(
                    'text-sm font-semibold transition-colors duration-200',
                    focused ? 'text-foreground' : isActive ? 'text-primary' : 'text-muted-foreground',
                  )}>
                    {track.label || track.language.toUpperCase()}
                  </span>
                </div>
              )}
            </Button>
          )
        })}
      </div>
    </VerticalList>
  )
}

export function TrackPanel({
  fKey,
  audioTracks,
  subtitleTracks,
  currentAudio,
  currentSubtitle,
  onSelectAudio,
  onSelectSubtitle,
}: TrackPanelProps) {
  return (
    <div className={cn(
      'absolute inset-y-0 left-0 w-72 flex flex-col',
      'bg-secondary/70 backdrop-blur-[32px] border-r border-border/10',
    )}>
      <div className="px-6 py-8 border-b border-border/10 shrink-0">
        <h2 className="font-headline text-lg font-black text-foreground tracking-tight">Ses & Altyazı</h2>
      </div>

      <HorizontalList fKey={fKey}>
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
          {/* audio */}
          <div>
            <div className="flex items-center gap-2 mb-3 px-2">
              <Volume2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Ses
              </span>
            </div>
            <TrackList
              fKey={`${fKey}-audio`}
              tracks={audioTracks}
              current={currentAudio}
              onSelect={onSelectAudio}
            />
          </div>

          {/* subtitles */}
          <div>
            <div className="flex items-center gap-2 mb-3 px-2">
              <Subtitles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Altyazı
              </span>
            </div>
            <TrackList
              fKey={`${fKey}-sub`}
              tracks={subtitleTracks}
              current={currentSubtitle}
              onSelect={onSelectSubtitle}
            />
          </div>
        </div>
      </HorizontalList>
    </div>
  )
}
