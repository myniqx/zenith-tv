import { WatchableObject } from '../../lib/content'
import { Expandable, Button, VerticalList } from '@navix/react'
import { Radio, Tv, Film, Play, Heart, Info } from 'lucide-react'
import { useContentBrowser } from './ContentBrowserProvider'
import { MediaPlayer } from '../MediaPlayer'
import { cn } from '../../lib/cn'
import { createPortal } from 'react-dom'

interface WatchableCardProps {
  fKey: string
  watchable: WatchableObject
}

const CATEGORY_MAP = {
  LiveStream: { label: 'CANLI', Icon: Radio, color: 'text-destructive' },
  Series: { label: 'DİZİ', Icon: Tv, color: 'text-primary' },
  Movie: { label: 'FİLM', Icon: Film, color: 'text-muted-foreground' },
} as const

export function WatchableCard({ fKey, watchable }: WatchableCardProps) {
  const { currentGroup } = useContentBrowser()

  const category = CATEGORY_MAP[watchable.category as keyof typeof CATEGORY_MAP] ?? CATEGORY_MAP.Movie
  const CategoryIcon = category.Icon

  const watchProgress = watchable.userData?.watchProgress
  const progressPercent = (watchProgress?.progress ?? 0) * 100
  const hasProgress = progressPercent > 0 && progressPercent < 95

  const groupItems = currentGroup.Watchables

  return (
    <Expandable fKey={fKey}>
      {({ isExpanded, directlyFocused, collapse }) => (
        <div className={cn(
          'relative aspect-2/3 bg-secondary rounded-lg overflow-hidden border transition-all duration-300',
          directlyFocused || isExpanded
            ? 'border-2 border-primary scale-100 shadow-lg shadow-primary/20 z-10'
            : 'border-border/10 scale-[0.98]',
        )}>
          {/* cover image */}
          {watchable.Logo ? (
            <img
              src={watchable.Logo}
              alt={watchable.Name}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-muted to-card">
              <CategoryIcon className="w-16 h-16 text-muted-foreground/40" />
            </div>
          )}

          {/* gradient overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-card via-transparent to-transparent opacity-90" />

          {/* focus overlay */}
          {(directlyFocused || isExpanded) && (
            <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
          )}

          {/* category badge */}
          <div className="absolute top-2 left-2">
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter',
              directlyFocused || isExpanded
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

          {/* bottom info — always same layout */}
          <div className="absolute bottom-0 p-3 w-full">
            <h3 className={cn(
              'font-headline font-bold leading-tight text-white line-clamp-2 transition-all duration-300',
              directlyFocused || isExpanded ? 'text-xl font-extrabold' : 'text-sm',
            )}>
              {watchable.Name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              {watchable.Year && (
                <span className={cn(
                  'text-[11px] font-semibold transition-colors duration-200',
                  directlyFocused || isExpanded ? 'text-primary font-bold' : 'text-primary/70',
                )}>
                  {watchable.Year}
                </span>
              )}
              {watchable.Year && watchable.Group && (
                <span className={cn('text-[11px]', directlyFocused || isExpanded ? 'text-primary/60' : 'text-muted-foreground')}>•</span>
              )}
              {watchable.Group && (
                <span className={cn('text-[11px] line-clamp-1', directlyFocused || isExpanded ? 'text-primary/80' : 'text-muted-foreground')}>
                  {watchable.Group}
                </span>
              )}
            </div>
          </div>

          {/* action overlay — bottom right, only when expanded */}
          {isExpanded && (
            <div className="absolute bottom-3 right-3">
              <VerticalList fKey={`${fKey}-actions`}>
                <div className="flex flex-col gap-1.5">

                  {/* play — inner expandable */}
                  <Expandable fKey={`${fKey}-play`}>
                    {({ isExpanded: playerOpen, focused, collapse: collapsePlayer }) => (
                      <>
                        <div className={cn(
                          'flex items-center gap-2 pl-3 pr-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer',
                          focused
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/40 scale-105'
                            : 'bg-black/60 backdrop-blur-sm text-white',
                        )}>
                          <Play className="w-3.5 h-3.5 translate-x-px" />
                          Oynat
                        </div>

                        {playerOpen && createPortal(
                          <MediaPlayer
                            watchable={watchable}
                            groupItems={groupItems}
                            onClose={() => { collapsePlayer(); collapse() }}
                            onSelectItem={() => { collapsePlayer(); collapse() }}
                          />,
                          document.body,
                        )}
                      </>
                    )}
                  </Expandable>

                  <Button fKey={`${fKey}-favorite`} onClick={() => { console.log("fav") }}>
                    {({ focused }) => (
                      <div className={cn(
                        'flex items-center gap-2 pl-3 pr-4 py-2 rounded-xl text-xs font-bold transition-all duration-200',
                        focused
                          ? 'bg-accent text-primary scale-105'
                          : 'bg-black/60 backdrop-blur-sm text-white/80',
                      )}>
                        <Heart className="w-3.5 h-3.5" />
                        Favori
                      </div>
                    )}
                  </Button>

                  <Button fKey={`${fKey}-info`} onClick={() => { }}>
                    {({ focused }) => (
                      <div className={cn(
                        'flex items-center gap-2 pl-3 pr-4 py-2 rounded-xl text-xs font-bold transition-all duration-200',
                        focused
                          ? 'bg-accent text-primary scale-105'
                          : 'bg-black/60 backdrop-blur-sm text-white/80',
                      )}>
                        <Info className="w-3.5 h-3.5" />
                        Bilgi
                      </div>
                    )}
                  </Button>

                </div>
              </VerticalList>
            </div>
          )}
        </div>
      )}
    </Expandable>
  )
}
