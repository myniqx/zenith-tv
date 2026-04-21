import { WatchableObject } from '@zenith-tv/content'
import { Button } from '@navix/react'
import { Radio, Tv, Film } from 'lucide-react'
import { useContentBrowser } from './ContentBrowserProvider'
import { cn } from '@zenith-tv/ui/lib'

interface WatchableCardProps {
  fKey: string
  watchable: WatchableObject
}

const CATEGORY_MAP = {
  LiveStream: { label: 'CANLI', Icon: Radio, color: 'text-destructive' },
  Series:     { label: 'DİZİ',  Icon: Tv,    color: 'text-primary' },
  Movie:      { label: 'FİLM',  Icon: Film,  color: 'text-muted-foreground' },
} as const

export function WatchableCard({ fKey, watchable }: WatchableCardProps) {
  const { openWatchable } = useContentBrowser()

  const category = CATEGORY_MAP[watchable.category as keyof typeof CATEGORY_MAP] ?? CATEGORY_MAP.Movie
  const CategoryIcon = category.Icon

  const watchProgress = watchable.userData?.watchProgress
  const progressPercent = (watchProgress?.progress ?? 0) * 100
  const hasProgress = progressPercent > 0 && progressPercent < 95

  return (
    <Button
      fKey={fKey}
      onClick={() => openWatchable(watchable)}
      className="block w-full h-full text-left p-0 cursor-pointer"
    >
      {({ focused }) => (
        <div className={cn(
          'relative aspect-2/3 bg-secondary rounded-lg overflow-hidden border transition-all duration-300',
          focused
            ? 'border-2 border-primary scale-100 shadow-lg shadow-primary/20 z-10'
            : 'border-border/10 scale-[0.98]',
        )}>
          {watchable.Logo ? (
            <img
              src={watchable.Logo}
              alt={watchable.Name}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-card">
              <CategoryIcon className="w-16 h-16 text-muted-foreground/40" />
            </div>
          )}

          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-90" />

          {/* focus overlay */}
          {focused && <div className="absolute inset-0 bg-primary/10 pointer-events-none" />}

          {/* category badge — top left */}
          <div className="absolute top-2 left-2">
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter',
              focused
                ? 'bg-accent text-primary'
                : `bg-card/80 ${category.color}`,
            )}>
              <CategoryIcon className="w-2.5 h-2.5" />
              {category.label}
            </span>
          </div>

          {/* watch progress bar */}
          {hasProgress && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-black/50">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          {/* bottom info */}
          <div className={cn('absolute bottom-0 w-full transition-all duration-300', focused ? 'p-5' : 'p-3')}>
            <h3 className={cn(
              'font-headline font-bold leading-tight text-white line-clamp-2 transition-all duration-300',
              focused ? 'text-xl font-extrabold' : 'text-sm',
            )}>
              {watchable.Name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              {watchable.Year && (
                <span className={cn(
                  'text-[11px] font-semibold transition-colors duration-200',
                  focused ? 'text-primary font-bold' : 'text-primary/70',
                )}>
                  {watchable.Year}
                </span>
              )}
              {watchable.Year && watchable.Group && (
                <span className={cn('text-[11px]', focused ? 'text-primary/60' : 'text-muted-foreground')}>•</span>
              )}
              {watchable.Group && (
                <span className={cn('text-[11px] line-clamp-1', focused ? 'text-primary/80' : 'text-muted-foreground')}>
                  {watchable.Group}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Button>
  )
}
