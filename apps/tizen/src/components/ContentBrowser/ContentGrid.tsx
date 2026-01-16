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

  // Debug state for last leave event
  const [lastLeave, setLastLeave] = useState<{ direction: string, time: string } | null>(null)

  // Stable handleLeave callback that doesn't change on re-renders
  const handleLeave = useCallback((direction: Direction) => {
    console.log('ContentGrid handleLeave triggered:', direction)

    // Update debug info
    setLastLeave({
      direction,
      time: new Date().toLocaleTimeString()
    })

    // Access fresh state via ref
    const {
      hasNext, hasPrev, focusedId, gridConfig, nextPage, prevPage
    } = stateRef.current

    if (direction === 'right' && hasNext) {
      console.log('Seamless Pagination: Moving Next Page')

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
      console.log('Pagination Target Index (Next):', targetIdx)
      pendingFocusIndex.current = targetIdx

      // Removed setFocusedId(null) to prevent focus loss artifacts and race conditions

      setSlideDirection('right')
      nextPage()

    } else if (direction === 'left' && hasPrev) {
      console.log('Seamless Pagination: Moving Prev Page')

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
      console.log('Pagination Target Index (Prev):', targetIdx)
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

  // Calculate generic focus coordinates for debug
  let focusCoords = { x: -1, y: -1 }
  if (focusedId && focusedId.startsWith('browser-slot-')) {
    const slotIdx = parseInt(focusedId.split('-')[2], 10)
    if (!isNaN(slotIdx)) {
      focusCoords = {
        x: slotIdx % gridConfig.cols,
        y: Math.floor(slotIdx / gridConfig.cols)
      }
    }
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

        {/* Debug Panel */}
        <div className="absolute top-2 right-2 bg-black/80 text-white p-2 rounded text-xs font-mono pointer-events-none z-50 border border-gray-700">
          <div className="font-bold text-yellow-500 border-b border-gray-600 mb-1">Grid Debugger</div>
          <div>Items: {currentItems.length}</div>
          <div>Page: {currentPage + 1} / {Math.ceil(currentItems.length / (gridConfig.cols * gridConfig.rows))}</div>
          <div>Range: {startIdx} - {endIdx}</div>
          <div>Focused: <span className="text-blue-300">{focusedId}</span></div>
          <div>Coords: X:{focusCoords.x} Y:{focusCoords.y}</div>
          <div>Pagination: {hasPrev ? '←PREV' : 'NO_PREV'} | {hasNext ? 'NEXT→' : 'NO_NEXT'}</div>
          {lastLeave && (
            <div className="mt-1 pt-1 border-t border-gray-600 text-red-300">
              Last Leave: {lastLeave.direction} <span className="text-gray-500">@{lastLeave.time}</span>
            </div>
          )}
        </div>
      </div>
    </FocusScope>
  )
}
