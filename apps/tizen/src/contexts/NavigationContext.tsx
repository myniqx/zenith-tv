import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'

export type Direction = 'up' | 'down' | 'left' | 'right'

interface NavigationContextValue {
  focusedId: string | null
  activeScopeId: string | null
  setFocusedId: (id: string | null) => void
  pushScope: (scopeId: string) => void
  popScope: (scopeId: string) => void
  moveFocus: (direction: Direction) => void
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider')
  }
  return context
}

interface NavigationProviderProps {
  children: ReactNode
  initialFocusId?: string
  onBack?: () => void
}

export function NavigationProvider({ children, initialFocusId, onBack }: NavigationProviderProps) {
  const [focusedId, setFocusedId] = useState<string | null>(initialFocusId || null)
  const [scopeStack, setScopeStack] = useState<string[]>([])

  const activeScopeId = scopeStack.length > 0 ? scopeStack[scopeStack.length - 1] : null

  const pushScope = useCallback((scopeId: string) => {
    setScopeStack(prev => {
      if (prev[prev.length - 1] === scopeId) {
        return prev
      }
      return [...prev, scopeId]
    })
  }, [])

  const popScope = useCallback((scopeId: string) => {
    setScopeStack(prev => {
      if (prev[prev.length - 1] === scopeId) {
        return prev.slice(0, -1)
      }
      return prev
    })
  }, [])

  const getFocusablesInScope = useCallback((scopeId: string | null): HTMLElement[] => {
    if (!scopeId) return []

    const selector = `[data-focus-scope="${scopeId}"][data-focus-id]`
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
  }, [])

  const focusedIdRef = useRef(focusedId)
  useEffect(() => {
    focusedIdRef.current = focusedId
  }, [focusedId])

  const activeScopeIdRef = useRef(activeScopeId)
  useEffect(() => {
    activeScopeIdRef.current = activeScopeId
  }, [activeScopeId])

  const moveFocus = useCallback((direction: Direction) => {
    const currentActiveScopeId = activeScopeIdRef.current
    const currentFocusedId = focusedIdRef.current

    const focusables = getFocusablesInScope(currentActiveScopeId)
    if (focusables.length === 0) return

    const currentElement = currentFocusedId
      ? document.querySelector<HTMLElement>(`[data-focus-id="${currentFocusedId}"]`)
      : null
    const currentIndex = currentElement ? focusables.indexOf(currentElement) : -1

    let nextIndex = currentIndex

    if (currentIndex === -1) {
      nextIndex = 0
    } else {
      const currentRect = currentElement!.getBoundingClientRect()

      const candidates = focusables
        .map((el, idx) => {
          if (idx === currentIndex) return null
          const rect = el.getBoundingClientRect()

          const isInDirection =
            (direction === 'right' && rect.left > currentRect.right) ||
            (direction === 'left' && rect.right < currentRect.left) ||
            (direction === 'down' && rect.top > currentRect.bottom) ||
            (direction === 'up' && rect.bottom < currentRect.top)

          if (!isInDirection) return null

          let primary: number
          let secondary: number

          if (direction === 'right' || direction === 'left') {
            primary = Math.abs(rect.left - currentRect.left)
            secondary = Math.abs(rect.top - currentRect.top)
          } else {
            primary = Math.abs(rect.top - currentRect.top)
            secondary = Math.abs(rect.left - currentRect.left)
          }

          const score = primary * 1000 + secondary

          return { element: el, index: idx, score }
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)

      if (candidates.length === 0) return

      candidates.sort((a, b) => a.score - b.score)
      nextIndex = candidates[0].index
    }

    const nextElement = focusables[nextIndex]
    const nextFocusId = nextElement.dataset.focusId
    if (!nextFocusId) return

    // Ref'i hemen güncelle (state'ten önce!)
    focusedIdRef.current = nextFocusId

    setFocusedId(nextFocusId)
    nextElement.focus()
    nextElement.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [getFocusablesInScope])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<number, Direction | 'enter' | 'back'> = {
        38: 'up',
        40: 'down',
        37: 'left',
        39: 'right',
        13: 'enter',
        10009: 'back',
        8: 'back',
        27: 'back',
      }

      const action = keyMap[e.keyCode]
      if (!action) return

      const currentFocusedId = focusedIdRef.current
      const focusedElement = currentFocusedId
        ? document.querySelector<HTMLElement>(`[data-focus-id="${currentFocusedId}"]`)
        : null

      if (focusedElement && (focusedElement instanceof HTMLInputElement || focusedElement instanceof HTMLTextAreaElement)) {
        if (action === 'left' || action === 'right') {
          return
        }
      }

      e.preventDefault()

      if (action === 'enter') {
        if (focusedElement) {
          focusedElement.click()
        }
      } else if (action === 'back') {
        onBack?.()
      } else {
        moveFocus(action)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [moveFocus, onBack])

  // Auto-focus: scope değiştiğinde ilk focusable'a focus et
  useEffect(() => {
    if (!focusedId && activeScopeId) {
      const focusables = getFocusablesInScope(activeScopeId)
      if (focusables.length > 0) {
        const firstId = focusables[0].dataset.focusId
        if (firstId) {
          focusedIdRef.current = firstId
          setFocusedId(firstId)
          focusables[0].focus()
        }
      }
    }
  }, [focusedId, activeScopeId, getFocusablesInScope])

  return (
    <NavigationContext.Provider
      value={{
        focusedId,
        activeScopeId,
        setFocusedId,
        pushScope,
        popScope,
        moveFocus,
      }}
    >
      {children}
    </NavigationContext.Provider>
  )
}
