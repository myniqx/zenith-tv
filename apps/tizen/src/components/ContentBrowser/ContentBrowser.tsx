import { GroupObject } from '../../lib/content'
import { ContentBrowserProvider } from './ContentBrowserProvider'
import { ContentGrid } from './ContentGrid'
import { cn } from '../../lib/cn'

interface ContentBrowserProps {
  initialGroup: GroupObject
  className?: string
  gridConfig?: {
    cols?: number
    rows?: number
  }
}

export function ContentBrowser({ initialGroup, className, gridConfig }: ContentBrowserProps) {
  return (
    <ContentBrowserProvider initialGroup={initialGroup} gridConfig={gridConfig}>
      <div className={cn('bg-background text-foreground flex flex-col overflow-hidden', className)}>
        <div className="flex-1 min-h-0 flex flex-col">
          <ContentGrid />
        </div>
      </div>
    </ContentBrowserProvider>
  )
}
