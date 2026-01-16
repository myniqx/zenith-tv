import { createContext, useContext, useState, useMemo, ReactNode } from 'react'
import { GroupObject, WatchableObject } from '@zenith-tv/content'

interface GridConfig {
  cols: number
  rows: number
}

interface PaginationInfo {
  hasPrev: boolean
  hasNext: boolean
  startIdx: number
  endIdx: number
  itemsPerPage: number
}

interface ContentBrowserContextValue {
  groupStack: GroupObject[]
  currentGroup: GroupObject
  currentItems: (GroupObject | WatchableObject)[]
  currentPage: number
  totalPages: number
  gridConfig: GridConfig
  bottomGroup: GroupObject

  paginationInfo: PaginationInfo

  pushGroup: (group: GroupObject) => void
  popGroup: () => void
  openWatchable: (item: WatchableObject) => void
  nextPage: () => void
  prevPage: () => void

  isPlayingVideo: boolean
  currentWatchable: WatchableObject | null
  closeVideo: () => void
}

const ContentBrowserContext = createContext<ContentBrowserContextValue | null>(null)

export const useContentBrowser = () => {
  const context = useContext(ContentBrowserContext)
  if (!context) {
    throw new Error('useContentBrowser must be used within ContentBrowserProvider')
  }
  return context
}

interface ContentBrowserProviderProps {
  children: ReactNode
  initialGroup: GroupObject
  gridConfig?: Partial<GridConfig>
}

export function ContentBrowserProvider({
  children,
  initialGroup,
  gridConfig: customGridConfig,
}: ContentBrowserProviderProps) {
  const gridConfig: GridConfig = {
    cols: customGridConfig?.cols ?? 6,
    rows: customGridConfig?.rows ?? 4,
  }

  const [groupStack, setGroupStack] = useState<GroupObject[]>([initialGroup])
  const [bottomGroup] = useState(initialGroup)
  const [currentPage, setCurrentPage] = useState(0)
  const [isPlayingVideo, setIsPlayingVideo] = useState(false)
  const [currentWatchable, setCurrentWatchable] = useState<WatchableObject | null>(null)

  const currentGroup = groupStack[groupStack.length - 1]

  const currentItems = useMemo(() => {
    return [...currentGroup.Groups, ...currentGroup.Watchables]
  }, [currentGroup])

  const TOTAL_SLOTS = useMemo(
    () => gridConfig.cols * gridConfig.rows,
    [gridConfig.cols, gridConfig.rows]
  )

  const calculatePageBoundaries = useMemo(
    () => (targetPage: number) => {
      let startIdx = 0
      let currentPageNum = 0

      while (currentPageNum < targetPage) {
        // In seamless mode, every page uses TOTAL_SLOTS
        const itemsOnPage = TOTAL_SLOTS
        startIdx += itemsOnPage
        currentPageNum++
      }

      return startIdx
    },
    [TOTAL_SLOTS]
  )

  const paginationInfo = useMemo(() => {
    const totalItems = currentItems.length
    if (totalItems === 0) {
      return {
        hasPrev: false,
        hasNext: false,
        startIdx: 0,
        endIdx: 0,
        itemsPerPage: 0,
      }
    }

    const startIdx = calculatePageBoundaries(currentPage)
    const hasPrev = currentPage > 0
    const remainingItems = totalItems - startIdx

    const itemsPerPage = TOTAL_SLOTS
    // if (hasPrev) itemsPerPage-- // Removed for seamless mode
    // if (hasNext) itemsPerPage-- // Removed for seamless mode

    const hasNext = remainingItems > itemsPerPage

    const endIdx = Math.min(startIdx + itemsPerPage, totalItems)

    return { hasPrev, hasNext, startIdx, endIdx, itemsPerPage }
  }, [currentPage, currentItems.length, TOTAL_SLOTS, calculatePageBoundaries])

  const totalPages = useMemo(() => {
    if (currentItems.length === 0) return 1
    return Math.ceil(currentItems.length / TOTAL_SLOTS)
  }, [currentItems.length, TOTAL_SLOTS])

  const pushGroup = (group: GroupObject) => {
    setGroupStack(prev => [...prev, group])
    setCurrentPage(0)
  }

  const popGroup = () => {
    if (groupStack.length > 1 && groupStack[0] !== bottomGroup) {
      setGroupStack(prev => prev.slice(0, -1))
      setCurrentPage(0)
    }
  }

  const openWatchable = (item: WatchableObject) => {
    setCurrentWatchable(item)
    setIsPlayingVideo(true)
  }

  const closeVideo = () => {
    setIsPlayingVideo(false)
    setCurrentWatchable(null)
  }

  const nextPage = () => {
    if (paginationInfo.hasNext) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const prevPage = () => {
    if (paginationInfo.hasPrev) {
      setCurrentPage(prev => Math.max(0, prev - 1))
    }
  }

  const value: ContentBrowserContextValue = {
    groupStack,
    currentGroup,
    currentItems,
    currentPage,
    totalPages,
    gridConfig,
    bottomGroup,
    paginationInfo,
    pushGroup,
    popGroup,
    openWatchable,
    nextPage,
    prevPage,
    isPlayingVideo,
    currentWatchable,
    closeVideo,
  }

  return (
    <ContentBrowserContext.Provider value={value}>
      {children}
    </ContentBrowserContext.Provider>
  )
}
