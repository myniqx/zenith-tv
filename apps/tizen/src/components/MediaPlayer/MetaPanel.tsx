import { WatchableObject } from '../../lib/content'
import { Radio, Tv, Film, Calendar, Folder } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { MultiLayerPanelProps } from '@navix/react'

interface MetaPanelProps extends MultiLayerPanelProps {
  watchable: WatchableObject
}

const CATEGORY_MAP = {
  LiveStream: { label: 'Canlı Yayın', Icon: Radio, color: 'text-destructive' },
  Series:     { label: 'Dizi',        Icon: Tv,    color: 'text-primary' },
  Movie:      { label: 'Film',        Icon: Film,  color: 'text-muted-foreground' },
} as const

export function MetaPanel({ watchable }: MetaPanelProps) {
  const category = CATEGORY_MAP[watchable.category as keyof typeof CATEGORY_MAP] ?? CATEGORY_MAP.Movie
  const CategoryIcon = category.Icon

  return (
    <div className={cn(
      'absolute inset-x-0 top-0 px-16 py-10',
      'bg-gradient-to-b from-black/80 via-black/40 to-transparent',
    )}>
      {/* category badge */}
      <div className="flex items-center gap-2 mb-4">
        <CategoryIcon className={cn('w-4 h-4', category.color)} />
        <span className={cn('text-xs font-bold uppercase tracking-widest', category.color)}>
          {category.label}
        </span>
      </div>

      {/* title */}
      <h1 className="font-headline text-5xl font-black text-white leading-none tracking-tight mb-4 max-w-3xl">
        {watchable.Name}
      </h1>

      {/* meta row */}
      <div className="flex items-center gap-4">
        {watchable.Year && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground">{watchable.Year}</span>
          </div>
        )}
        {watchable.Group && (
          <>
            {watchable.Year && <span className="text-muted-foreground/40">•</span>}
            <div className="flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground">{watchable.Group}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
