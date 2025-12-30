import { WatchableObject } from '@zenith-tv/content'
import { FocusCard } from '@/components/Navigation'
import { CardContent } from '@zenith-tv/ui/card'
import { Badge } from '@zenith-tv/ui/badge'
import { Radio, Tv, Film } from 'lucide-react'
import { useContentBrowser } from './ContentBrowserProvider'

interface WatchableCardProps {
  watchable: WatchableObject
}

export function WatchableCard({ watchable }: WatchableCardProps) {
  const { openWatchable } = useContentBrowser()

  const getCategoryBadge = () => {
    if (watchable.category === 'LiveStream') {
      return { text: 'LIVE', variant: 'destructive' as const, icon: Radio }
    }
    if (watchable.category === 'Series') {
      return { text: 'SERIES', variant: 'secondary' as const, icon: Tv }
    }
    return { text: 'MOVIE', variant: 'default' as const, icon: Film }
  }

  const badge = getCategoryBadge()
  const CategoryIcon = badge.icon

  const watchProgress = watchable.userData?.watchProgress
  const progressPercent = (watchProgress?.progress ?? 0) * 100

  const handleClick = () => {
    openWatchable(watchable)
  }

  return (
    <FocusCard
      focusId={`watchable-${watchable.Url}`}
      onClick={handleClick}
      className="h-full"
    >
      <CardContent className="p-0 h-full flex flex-col">
        <div className="relative aspect-[2/3] bg-gray-800 rounded-t-lg overflow-hidden">
          {watchable.Logo ? (
            <img
              src={watchable.Logo}
              alt={watchable.Name}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-700">
              <CategoryIcon className="w-16 h-16 text-gray-600" />
            </div>
          )}

          <Badge variant={badge.variant} className="absolute top-2 right-2">
            {badge.text}
          </Badge>

          {watchable.Year && (
            <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 rounded text-xs text-white">
              {watchable.Year}
            </div>
          )}

          {watchProgress && progressPercent > 0 && progressPercent < 95 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
              <div
                className="h-full bg-red-600 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>

        <div className="p-3 flex-1">
          <h3 className="text-sm font-medium line-clamp-2">{watchable.Name}</h3>
          {watchable.Group && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-1">{watchable.Group}</p>
          )}
        </div>
      </CardContent>
    </FocusCard>
  )
}
