import { GroupObject, WatchableObject } from '@zenith-tv/content'
import { useContentBrowser } from './ContentBrowserProvider'
import { NavigationCard } from './NavigationCard'
import { GroupCard } from './GroupCard'
import { WatchableCard } from './WatchableCard'

export function ContentGrid() {
  const {
    currentItems,
    currentPage,
    paginationInfo,
    gridConfig,
    nextPage,
    prevPage,
  } = useContentBrowser()

  const { hasPrev, hasNext, startIdx, endIdx } = paginationInfo

  const slots: JSX.Element[] = []

  if (hasPrev) {
    slots.push(
      <NavigationCard
        key="nav-prev"
        type="prev"
        onClick={prevPage}
        page={currentPage}
      />
    )
  }

  const pageItems = currentItems.slice(startIdx, endIdx)

  pageItems.forEach((item, index) => {
    if (item instanceof GroupObject) {
      slots.push(<GroupCard key={`group-${item.Name}-${index}`} group={item} />)
    } else if (item instanceof WatchableObject) {
      slots.push(<WatchableCard key={`watchable-${item.Url}-${index}`} watchable={item} />)
    }
  })

  const totalSlots = gridConfig.cols * gridConfig.rows
  while (slots.length < totalSlots - (hasNext ? 1 : 0)) {
    slots.push(<div key={`empty-${slots.length}`} className="invisible" />)
  }

  if (hasNext) {
    slots.push(
      <NavigationCard
        key="nav-next"
        type="next"
        onClick={nextPage}
        page={currentPage + 2}
      />
    )
  }

  return (
    <div
      className="grid gap-3 p-4 h-full"
      style={{
        gridTemplateColumns: `repeat(${gridConfig.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${gridConfig.rows}, minmax(0, 1fr))`,
      }}
    >
      {slots}
    </div>
  )
}
