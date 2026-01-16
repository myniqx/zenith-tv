import { GroupObject, WatchableObject } from '@zenith-tv/content'
import { useContentBrowser } from './ContentBrowserProvider'
import { GroupCard } from './GroupCard'
import { WatchableCard } from './WatchableCard'
import { FocusScope } from '@/contexts/FocusScope'
import { useNavigation, Direction } from '@/contexts/NavigationContext'
import { useEffect, useRef, useCallback, useState, JSX } from 'react'

export function ContentGrid() {
  const {
    currentItems,
    paginationInfo,
    gridConfig,
    currentPage,
    nextPage,
    prevPage,
  } = useContentBrowser()

  const { hasPrev, hasNext, startIdx, endIdx } = paginationInfo
  const { setFocusedId, focusedId } = useNavigation()

  // Track the pending focus index for page transitions
  const pendingFocusIndex = useRef<number | null>(null)

  // Animation state
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null)

  // Keep track of latest state in a ref instead of dependency array
  const stateRef = useRef({
    focusedId,
    hasNext,
    hasPrev,
    gridConfig,
    endIdx,
    startIdx,
    nextPage,
    prevPage,
    setFocusedId
  })

  // Update ref on every render
  useEffect(() => {
    stateRef.current = {
      focusedId,
      hasNext,
      hasPrev,
      gridConfig,
      endIdx,
      startIdx,
      nextPage,
      prevPage,
      setFocusedId
    }
  })

  // Reset animation after it completes
  useEffect(() => {
    if (slideDirection) {
      const timer = setTimeout(() => {
        setSlideDirection(null)
      }, 300) // Match CSS duration
      return () => clearTimeout(timer)
    }
  }, [slideDirection])

  // Apply pending focus after render
  useEffect(() => {
    if (pendingFocusIndex.current !== null) {
      // Ensure we don't focus out of bounds if the new page has fewer items
      const pageItemsCount = endIdx - startIdx
      const targetIndex = Math.min(pendingFocusIndex.current, pageItemsCount - 1)

      if (targetIndex >= 0) {
        setFocusedId(`browser-slot-${targetIndex}`)
      }
      pendingFocusIndex.current = null
    }
  }, [currentItems, startIdx, endIdx, setFocusedId])

  // Stable handleLeave callback that doesn't change on re-renders
  const handleLeave = useCallback((direction: Direction) => {
    // Access fresh state via ref
    const {
      hasNext, hasPrev, focusedId, gridConfig, nextPage, prevPage
    } = stateRef.current

    if (direction === 'right' && hasNext) {
      // Calculate current row to preserve context
      const currentSlotId = focusedId
      let rowIndex = 0

      if (currentSlotId && currentSlotId.startsWith('browser-slot-')) {
        const slotIndex = parseInt(currentSlotId.split('-')[2], 10)
        if (!isNaN(slotIndex)) {
          rowIndex = Math.floor(slotIndex / gridConfig.cols)
        }
      }

      // Target: Start of the same row on next page
      const targetIdx = rowIndex * gridConfig.cols
      pendingFocusIndex.current = targetIdx

      // Removed setFocusedId(null) to prevent focus loss artifacts and race conditions

      setSlideDirection('right')
      nextPage()

    } else if (direction === 'left' && hasPrev) {
      // Prev page logic
      const currentSlotId = focusedId
      let rowIndex = 0

      if (currentSlotId && currentSlotId.startsWith('browser-slot-')) {
        const slotIndex = parseInt(currentSlotId.split('-')[2], 10)
        if (!isNaN(slotIndex)) {
          rowIndex = Math.floor(slotIndex / gridConfig.cols)
        }
      }

      // Target: End of the same row on prev page
      const targetIdx = rowIndex * gridConfig.cols + (gridConfig.cols - 1)
      pendingFocusIndex.current = targetIdx

      // Removed setFocusedId(null) to prevent focus loss artifacts and race conditions

      setSlideDirection('left')
      prevPage()
    }
  }, []) // Empty dependency array = stable reference

  const pageItems = currentItems.slice(startIdx, endIdx)
  const slots: JSX.Element[] = []
  const totalSlots = gridConfig.cols * gridConfig.rows

  for (let i = 0; i < totalSlots; i++) {
    const item = pageItems[i]
    if (item) {
      const slotId = `browser-slot-${i}`
      if (item instanceof GroupObject) {
        slots.push(<GroupCard key={`group-${item.Name}-${i}`} group={item} focusId={slotId} />)
      } else if (item instanceof WatchableObject) {
        slots.push(<WatchableCard key={`watchable-${item.Url}-${i}`} watchable={item} focusId={slotId} />)
      }
    } else {
      slots.push(<div key={`empty-${i}`} className="invisible" />)
    }
  }

  // Calculate transform for slide effect
  let transformClass = 'translate-x-0'

  // Note: This is a simplified "enter" animation. 
  // For true exit/enter we'd need AnimatePresence, but this gives a visual cue.
  if (slideDirection === 'right') {
    transformClass = 'animate-slide-in-right'
  } else if (slideDirection === 'left') {
    transformClass = 'animate-slide-in-left'
  }

  return (
    <FocusScope id="content-grid" onLeave={handleLeave}>
      <div className="overflow-hidden h-full relative p-4">
        <div
          className={`grid gap-6 h-full transition-all duration-300 ease-out ${transformClass}`}
          key={currentPage} // Restart animation on page change
          style={{
            gridTemplateColumns: `repeat(${gridConfig.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${gridConfig.rows}, minmax(0, 1fr))`,
          }}
        >
          {slots}
        </div>
      </div>
    </FocusScope>
  )
}
