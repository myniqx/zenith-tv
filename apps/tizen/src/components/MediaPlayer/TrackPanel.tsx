import { Volume2, Subtitles } from 'lucide-react'
import { Button, VerticalList, HorizontalList } from '@navix/react'
import { cn } from '../../lib/cn'
import type { MultiLayerPanelProps } from '@navix/react'
import type { VlcTrack } from '../../lib/content'
import { useTizenPlayerStore } from '../../stores/tizenPlayer'

function TrackList({
  fKey,
  tracks,
  current,
  onSelect,
}: {
  fKey: string
  tracks: VlcTrack[]
  current: number
  onSelect: (id: number) => void
}) {
  if (tracks.length === 0) {
    return <p className="text-xs text-muted-foreground/50 px-2 py-1">Track bulunamadı</p>
  }

  return (
    <VerticalList fKey={fKey}>
      <div className="space-y-1">
        {tracks.map((track) => {
          const isActive = track.id === current
          return (
            <Button
              key={track.id}
              fKey={`${fKey}-${track.id}`}
              onClick={() => onSelect(track.id)}
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
                    {track.name}
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

export function TrackPanel({ fKey }: MultiLayerPanelProps) {
  const { audioTracks, subtitleTracks, currentAudioTrack, currentSubtitleTrack, audio, subtitle } =
    useTizenPlayerStore()

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
              current={currentAudioTrack}
              onSelect={(id) => audio({ track: id })}
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
              current={currentSubtitleTrack}
              onSelect={(id) => subtitle({ track: id })}
            />
          </div>
        </div>
      </HorizontalList>
    </div>
  )
}
