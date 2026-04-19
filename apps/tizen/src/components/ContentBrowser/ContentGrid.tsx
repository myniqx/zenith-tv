import { useRef, useEffect, useState } from 'react'
import { GroupObject, WatchableObject } from '@zenith-tv/content'
import { useContentBrowser } from './ContentBrowserProvider'
import { GroupCard } from './GroupCard'
import { WatchableCard } from './WatchableCard'
import { PaginatedGrid } from '@navix/react'

export function ContentGrid() {
  const { currentItems, gridConfig } = useContentBrowser()
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(entry.contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden p-4">
      {height > 0 && (
        <PaginatedGrid
          fKey="content-grid"
          orientation="horizontal"
          items={currentItems}
          rows={gridConfig.rows}
          columns={gridConfig.cols}
          threshold={1}
          gap={24}
          outerStyle={{ height: height - 32 }}
          renderItem={(item, fKey) => {
            if (item instanceof GroupObject) {
              return <GroupCard fKey={fKey} group={item} />
            }
            return <WatchableCard fKey={fKey} watchable={item as WatchableObject} />
          }}
        />
      )}
    </div>
  )
}
