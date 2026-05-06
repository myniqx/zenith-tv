import { WatchableObject } from '../../lib/content'
import { Button, VerticalList } from '@navix/react'
import { Play, Radio, Tv, Film } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { MultiLayerPanelProps } from '@navix/react'

interface EpisodePanelProps extends MultiLayerPanelProps {
  items: WatchableObject[]
  current: WatchableObject
  onSelect: (item: WatchableObject) => void
}

const CATEGORY_ICON = {
  LiveStream: Radio,
  Series: Tv,
  Movie: Film,
} as const

export function EpisodePanel({ fKey, items, current, onSelect, close }: EpisodePanelProps) {
  return (
    <div className={cn(
      'absolute inset-y-0 right-0 w-80 flex flex-col',
      'bg-secondary/70 backdrop-blur-[32px] border-l border-border/10',
    )}>
      <div className="px-6 py-8 border-b border-border/10 shrink-0">
        <h2 className="font-headline text-lg font-black text-foreground tracking-tight">
          {current.Group || 'Liste'}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">{items.length} içerik</p>
      </div>

      <VerticalList fKey={fKey}>
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {items.map((item, i) => {
            const isCurrent = item.Url === current.Url
            const Icon = CATEGORY_ICON[item.category as keyof typeof CATEGORY_ICON] ?? Film

            return (
              <Button
                key={item.Url}
                fKey={`${fKey}-${i}`}
                onClick={() => { onSelect(item); close() }}
              >
                {({ focused }) => (
                  <div className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                    focused ? 'bg-accent' : isCurrent ? 'bg-primary/10 border-l-2 border-primary' : '',
                  )}>
                    {item.Logo ? (
                      <img
                        src={item.Logo}
                        alt={item.Name}
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                        isCurrent ? 'bg-primary/20' : 'bg-muted',
                      )}>
                        {focused || isCurrent
                          ? <Play className="w-4 h-4 text-primary translate-x-0.5" />
                          : <Icon className="w-4 h-4 text-muted-foreground/50" />
                        }
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        'text-sm font-semibold truncate transition-colors duration-200',
                        focused ? 'text-foreground' : isCurrent ? 'text-primary' : 'text-foreground/80',
                      )}>
                        {item.Name}
                      </p>
                      {item.Year && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.Year}</p>
                      )}
                    </div>
                  </div>
                )}
              </Button>
            )
          })}
        </div>
      </VerticalList>
    </div>
  )
}
