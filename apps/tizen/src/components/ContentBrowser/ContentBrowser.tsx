import { GroupObject } from '@zenith-tv/content'
import { ContentBrowserProvider, useContentBrowser } from './ContentBrowserProvider'
import { ContentGrid } from './ContentGrid'
import { VideoPlayer } from './VideoPlayer'

interface ContentBrowserProps {
  initialGroup: GroupObject
  gridConfig?: {
    cols?: number
    rows?: number
  }
}

function ContentBrowserInner() {
  const {
    groupStack,
    currentGroup,
    currentPage,
    totalPages,
    isPlayingVideo,
    currentWatchable,
    closeVideo,
  } = useContentBrowser()

  const breadcrumb = groupStack.map(g => g.Name).join(' > ')

  return (
    <div className="h-full bg-background text-foreground flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <ContentGrid />
      </div>

      {isPlayingVideo && currentWatchable && (
        <VideoPlayer watchable={currentWatchable} onClose={closeVideo} />
      )}
    </div>
  )
}

export function ContentBrowser({ initialGroup, gridConfig }: ContentBrowserProps) {
  return (
    <ContentBrowserProvider initialGroup={initialGroup} gridConfig={gridConfig}>
      <ContentBrowserInner />
    </ContentBrowserProvider>
  )
}
