import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'

export type Direction = 'up' | 'down' | 'left' | 'right'

interface ScopeItem {
  id: string
  onBack?: () => void
}

interface NavigationContextValue {
  focusedId: string | null
  activeScopeId: string | null
  setFocusedId: (id: string | null, preventScroll?: boolean) => void
  pushScope: (scopeId: string, onBack?: () => void) => void
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
  const [focusedId, setFocusedIdState] = useState<string | null>(initialFocusId || null)
  const [scopeStack, setScopeStack] = useState<ScopeItem[]>([])

  // With default useEffect order, children mount first (push first).
  // So stack is [Child, Parent].
  // Active scope should ideally be the Child (index 0).
  const activeScopeId = scopeStack.length > 0 ? scopeStack[0].id : null

  const focusedIdRef = useRef(focusedId)
  useEffect(() => {
    focusedIdRef.current = focusedId
  }, [focusedId])

  const scopeStackRef = useRef(scopeStack)
  useEffect(() => {
    scopeStackRef.current = scopeStack
  }, [scopeStack])

  const pushScope = useCallback((scopeId: string, onBackHandler?: () => void) => {
    setScopeStack(prev => {
      // Prevent duplicates at the detailed level?
      // Actually we just check if it's already in the stack to avoid loops/dups if strict mode double invokes
      if (prev.some(s => s.id === scopeId)) return prev
      return [...prev, { id: scopeId, onBack: onBackHandler }]
    })
  }, [])

  const popScope = useCallback((scopeId: string) => {
    setScopeStack(prev => prev.filter(s => s.id !== scopeId))
  }, [])

  const getFocusables = useCallback((scopes: ScopeItem[]): { element: HTMLElement, scopeId: string }[] => {
    // Universal Search: Get focusables from ALL active scopes.
    // This allows moving from Child -> Parent (Header) -> Sibling (Sidebar) cleanly.
    if (scopes.length === 0) return []

    // Optimization: Query all focusables once if performance is an issue, but scopes selector is fine.
    // Flatten result
    const results: { element: HTMLElement, scopeId: string }[] = []

    scopes.forEach(scope => {
      const selector = `[data-focus-scope="${scope.id}"][data-focus-id]`
      const elements = document.querySelectorAll<HTMLElement>(selector)
      elements.forEach(el => results.push({ element: el, scopeId: scope.id }))
    })

    return results
  }, [])

  const setFocusedId = useCallback((id: string | null, preventScroll = false) => {
    setFocusedIdState(id)
    focusedIdRef.current = id

    if (id) {
      const element = document.querySelector<HTMLElement>(`[data-focus-id="${id}"]`)
      if (element) {
        // Only force focus if we are not preventing scroll (implies keyboard nav)
        // Or if we specifically want to sync DOM focus.
        // For mouse hover, we usually DON'T want to steal keyboard focus instantly to avoid virtual keyboard flickering?
        // Actually for hybrid, we want the element to be document.activeElement so Enter key works.
        // `focus({ preventScroll: true })` is the standard way.
        element.focus({ preventScroll: true })

        if (!preventScroll) {
          element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
        }
      }
    }
  }, [])

  const moveFocus = useCallback((direction: Direction) => {
    const currentFocusedId = focusedIdRef.current
    const currentStack = scopeStackRef.current

    const allFocusables = getFocusables(currentStack)
    if (allFocusables.length === 0) return

    const currentElement = currentFocusedId
      ? document.querySelector<HTMLElement>(`[data-focus-id="${currentFocusedId}"]`)
      : null

    const currentIndex = currentElement
      ? allFocusables.findIndex(f => f.element === currentElement)
      : -1

    let nextElement: HTMLElement | null = null

    if (currentIndex === -1) {
      // Default to first available in the Child-most scope (index 0)
      nextElement = allFocusables[0]?.element
    } else {
      const currentRect = currentElement!.getBoundingClientRect()

      const candidates = allFocusables
        .map((item, idx) => {
          if (item.element === currentElement) return null
          const rect = item.element.getBoundingClientRect()

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
          return { element: item.element, score }
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)

      if (candidates.length > 0) {
        candidates.sort((a, b) => a.score - b.score)
        nextElement = candidates[0].element
      }
    }

    if (nextElement) {
      const nextFocusId = nextElement.dataset.focusId
      if (nextFocusId) {
        setFocusedId(nextFocusId) // preventScroll = false (default)
      }
    }
  }, [getFocusables, setFocusedId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<number, Direction | 'enter' | 'back'> = {
        38: 'up', 40: 'down', 37: 'left', 39: 'right',
        13: 'enter', 10009: 'back', 8: 'back', 27: 'back',
      }
      const action = keyMap[e.keyCode]
      if (!action) return

      const currentFocusedId = focusedIdRef.current
      const focusedElement = currentFocusedId
        ? document.querySelector<HTMLElement>(`[data-focus-id="${currentFocusedId}"]`)
        : null

      if (focusedElement && (focusedElement instanceof HTMLInputElement || focusedElement instanceof HTMLTextAreaElement)) {
        if (action === 'left' || action === 'right') return
      }

      e.preventDefault()

      if (action === 'enter') {
        focusedElement?.click()
      } else if (action === 'back') {
        const currentStack = scopeStackRef.current

        // Traverse stack based on logic: Child (0) -> Parent (N)
        // Find first one that handles back
        let handled = false
        for (const scope of currentStack) {
          if (scope.onBack) {
            scope.onBack()
            handled = true
            break
          }
        }

        if (!handled && onBack) {
          onBack()
        }
      } else {
        moveFocus(action)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [moveFocus, onBack])

  // Initial auto-focus logic
  useEffect(() => {
    // Only run if we have no focus yet and we have a scope
    if (!focusedId && activeScopeId) {
      // Try to find something in the top (child) scope first
      const selector = `[data-focus-scope="${activeScopeId}"][data-focus-id]`
      const firstEl = document.querySelector<HTMLElement>(selector)

      if (firstEl && firstEl.dataset.focusId) {
        setFocusedId(firstEl.dataset.focusId)
      }
    }
  }, [focusedId, activeScopeId, setFocusedId])

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
