import { GroupObject } from '@zenith-tv/content'
import { FocusCard } from '@/components/Navigation'
import { CardContent } from '@zenith-tv/ui/card'
import { Folder } from 'lucide-react'
import { useContentBrowser } from './ContentBrowserProvider'
import { useMemo } from 'react'

interface GroupCardProps {
  group: GroupObject
  focusId?: string
}

export function GroupCard({ group, focusId }: GroupCardProps) {
  const { pushGroup } = useContentBrowser()
  const Icon = group.GetListIcon
  const coverImages = useMemo(() => group.getImageList(9), [group])

  const handleClick = () => {
    pushGroup(group)
  }

  return (
    <FocusCard
      focusId={focusId || `group-${group.Name}`}
      onClick={handleClick}
      className="h-full"
    >
      <CardContent className="p-0 h-full flex flex-col">
        <div className="relative aspect-[2/3] bg-muted rounded-t-lg overflow-hidden">
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
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/70">
                      <Folder className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
              ))}
              {Array.from({ length: Math.max(0, 9 - coverImages.length) }).map((_, index) => (
                <div key={`empty-${index}`} className="bg-muted/70 flex items-center justify-center">
                  <Folder className="w-4 h-4 text-muted-foreground/40" />
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/70">
              <Icon className="w-16 h-16 text-muted-foreground/40" />
            </div>
          )}

          <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white font-medium">
            {group.TotalCount} items
          </div>
        </div>

        <div className="p-3 flex-1">
          <h3 className="text-sm font-medium line-clamp-2 flex items-center gap-2">
            <Icon className="w-4 h-4 flex-shrink-0" />
            {group.Name}
          </h3>
          {group.Groups.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {group.Groups.length} subgroups
            </p>
          )}
        </div>
      </CardContent>
    </FocusCard>
  )
}
