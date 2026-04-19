import { GroupObject } from '@zenith-tv/content'
import { ContentBrowserProvider, useContentBrowser } from './ContentBrowserProvider'
import { ContentGrid } from './ContentGrid'
import { VideoPlayer } from './VideoPlayer'
import { cn } from '@zenith-tv/ui/lib'

interface ContentBrowserProps {
  initialGroup: GroupObject
  className?: string
  gridConfig?: {
    cols?: number
    rows?: number
  }
}

function ContentBrowserInner({ className }: { className?: string }) {
  const { isPlayingVideo, currentWatchable, closeVideo } = useContentBrowser()

  return (
    <div className={cn('bg-background text-foreground flex flex-col overflow-hidden', className)}>
      <div className="flex-1 min-h-0 flex flex-col">
        <ContentGrid />
      </div>

      {isPlayingVideo && currentWatchable && (
        <VideoPlayer watchable={currentWatchable} onClose={closeVideo} />
      )}
    </div>
  )
}

export function ContentBrowser({ initialGroup, className, gridConfig }: ContentBrowserProps) {
  return (
    <ContentBrowserProvider initialGroup={initialGroup} gridConfig={gridConfig}>
      <ContentBrowserInner className={className} />
    </ContentBrowserProvider>
  )
}
