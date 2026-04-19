import { createContext, useContext, useState, useMemo, ReactNode } from 'react'
import { GroupObject, WatchableObject } from '@zenith-tv/content'

interface GridConfig {
  cols: number
  rows: number
}

interface ContentBrowserContextValue {
  groupStack: GroupObject[]
  currentGroup: GroupObject
  currentItems: (GroupObject | WatchableObject)[]
  gridConfig: GridConfig

  pushGroup: (group: GroupObject) => void
  popGroup: () => void
  openWatchable: (item: WatchableObject) => void

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
    cols: customGridConfig?.cols ?? 9,
    rows: customGridConfig?.rows ?? 3,
  }

  const [groupStack, setGroupStack] = useState<GroupObject[]>([initialGroup])
  const [isPlayingVideo, setIsPlayingVideo] = useState(false)
  const [currentWatchable, setCurrentWatchable] = useState<WatchableObject | null>(null)

  const currentGroup = groupStack[groupStack.length - 1]

  const currentItems = useMemo(() => {
    return [...currentGroup.Groups, ...currentGroup.Watchables]
  }, [currentGroup])

  const pushGroup = (group: GroupObject) => {
    setGroupStack(prev => [...prev, group])
  }

  const popGroup = () => {
    if (groupStack.length > 1) {
      setGroupStack(prev => prev.slice(0, -1))
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

  return (
    <ContentBrowserContext.Provider value={{
      groupStack,
      currentGroup,
      currentItems,
      gridConfig,
      pushGroup,
      popGroup,
      openWatchable,
      isPlayingVideo,
      currentWatchable,
      closeVideo,
    }}>
      {children}
    </ContentBrowserContext.Provider>
  )
}
