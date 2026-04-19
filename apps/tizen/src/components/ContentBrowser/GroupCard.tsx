import { GroupObject } from '@zenith-tv/content'
import { Button } from '@navix/react'
import { Folder } from 'lucide-react'
import { useContentBrowser } from './ContentBrowserProvider'
import { useMemo } from 'react'
import { cn } from '@zenith-tv/ui/lib'

interface GroupCardProps {
  fKey: string
  group: GroupObject
}

export function GroupCard({ fKey, group }: GroupCardProps) {
  const { pushGroup } = useContentBrowser()
  const Icon = group.GetListIcon
  const coverImages = useMemo(() => group.getImageList(9), [group])

  return (
    <Button
      fKey={fKey}
      onClick={() => pushGroup(group)}
      className="block w-full h-full text-left p-0 cursor-pointer"
    >
      {({ focused }) => (
        <div className={cn(
          'relative aspect-2/3 bg-secondary rounded-lg overflow-hidden border transition-all duration-300',
          focused
            ? 'border-primary/40 scale-105 shadow-lg shadow-primary/15'
            : 'border-border/10',
        )}>
          {coverImages.length > 0 ? (
            <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-0.5">
              {coverImages.slice(0, 9).map((cover, index) => (
                <div key={index} className="relative overflow-hidden bg-muted/70">
                  {cover.Logo ? (
                    <img
                      src={cover.Logo}
                      alt={cover.Name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <Folder className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
              ))}
              {Array.from({ length: Math.max(0, 9 - coverImages.length) }).map((_, index) => (
                <div key={`empty-${index}`} className="bg-muted flex items-center justify-center">
                  <Folder className="w-4 h-4 text-muted-foreground/40" />
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-card">
              <Icon className="w-16 h-16 text-muted-foreground/40" />
            </div>
          )}

          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-90" />

          {/* bottom info */}
          <div className="absolute bottom-0 p-3 w-full">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {group.Groups.length > 0 ? 'Klasör' : 'Grup'}
              </span>
            </div>
            <h3 className="text-sm font-bold leading-tight text-foreground line-clamp-2">
              {group.Name}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              <span className={cn('font-semibold', focused ? 'text-primary' : 'text-primary/70')}>
                {group.TotalCount}
              </span>
              {' '}öğe
              {group.Groups.length > 0 && ` • ${group.Groups.length} alt grup`}
            </p>
          </div>
        </div>
      )}
    </Button>
  )
}
