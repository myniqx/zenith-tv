import { GroupObject } from '@zenith-tv/content'
import { ContentBrowserProvider, useContentBrowser } from './ContentBrowserProvider'
import { ContentGrid } from './ContentGrid'
import { VideoPlayerStub } from './VideoPlayerStub'

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
    <div className="h-full bg-gray-900 text-white flex flex-col overflow-hidden">
      <div className="px-8 py-4 bg-gray-800 border-b border-gray-700">
        <p className="text-gray-400 text-sm mb-1">{breadcrumb}</p>
        <div className="flex items-center justify-between">
          <p className="text-white text-lg font-semibold">
            {currentGroup.TotalCount} items
          </p>
          <p className="text-gray-400 text-sm">
            Page {currentPage + 1} of {totalPages}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ContentGrid />
      </div>

      {isPlayingVideo && currentWatchable && (
        <VideoPlayerStub watchable={currentWatchable} onClose={closeVideo} />
      )}

      <div className="bg-gray-800 px-8 py-4 text-gray-400 text-sm flex gap-8 border-t border-gray-700">
        <span>↑ ↓ ← → : Navigate</span>
        <span>Enter : Select</span>
        <span>ESC : Back</span>
      </div>
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
