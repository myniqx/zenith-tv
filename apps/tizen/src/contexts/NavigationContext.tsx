import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'

export type Direction = 'up' | 'down' | 'left' | 'right'
export type FocusableElement = HTMLElement & { dataset: { focusId: string; focusScope?: string } }

interface FocusableRegistry {
  [focusId: string]: FocusableElement
}

interface NavigationContextValue {
  focusedId: string | null
  activeScopeId: string | null
  setFocusedId: (id: string | null) => void
  registerFocusable: (id: string, element: FocusableElement, scopeId?: string) => void
  unregisterFocusable: (id: string) => void
  setActiveScope: (scopeId: string | null) => void
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
  const [activeScopeId, setActiveScope] = useState<string | null>(null)
  const registryRef = useRef<FocusableRegistry>({})

  const registerFocusable = useCallback((id: string, element: FocusableElement, scopeId?: string) => {
    registryRef.current[id] = element
    if (scopeId) {
      element.dataset.focusScope = scopeId
    }
  }, [])

  const unregisterFocusable = useCallback((id: string) => {
    delete registryRef.current[id]
  }, [])

  const getFocusablesInScope = useCallback((scopeId: string | null): FocusableElement[] => {
    return Object.values(registryRef.current).filter(el => {
      const elementScope = el.dataset.focusScope || null
      return elementScope === scopeId
    })
  }, [])

  const moveFocus = useCallback((direction: Direction) => {
    const focusables = getFocusablesInScope(activeScopeId)
    if (focusables.length === 0) return

    const currentElement = focusedId ? registryRef.current[focusedId] : null
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
            (direction === 'right' && rect.left > currentRect.left) ||
            (direction === 'left' && rect.right < currentRect.right) ||
            (direction === 'down' && rect.top > currentRect.top) ||
            (direction === 'up' && rect.bottom < currentRect.bottom)

          if (!isInDirection) return null

          const distance = Math.sqrt(
            Math.pow(rect.left - currentRect.left, 2) +
            Math.pow(rect.top - currentRect.top, 2)
          )

          return { element: el, index: idx, distance }
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)

      if (candidates.length > 0) {
        candidates.sort((a, b) => a.distance - b.distance)
        nextIndex = candidates[0].index
      } else {
        if (direction === 'right' || direction === 'down') {
          nextIndex = (currentIndex + 1) % focusables.length
        } else {
          nextIndex = currentIndex - 1 < 0 ? focusables.length - 1 : currentIndex - 1
        }
      }
    }

    const nextElement = focusables[nextIndex]
    setFocusedId(nextElement.dataset.focusId)
    nextElement.focus()
  }, [focusedId, activeScopeId, getFocusablesInScope])

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

      e.preventDefault()

      if (action === 'enter') {
        const focusedElement = focusedId ? registryRef.current[focusedId] : null
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
  }, [focusedId, moveFocus, onBack])

  useEffect(() => {
    if (!focusedId && activeScopeId) {
      const focusables = getFocusablesInScope(activeScopeId)
      if (focusables.length > 0) {
        const firstId = focusables[0].dataset.focusId
        setFocusedId(firstId)
        focusables[0].focus()
      }
    }
  }, [focusedId, activeScopeId, getFocusablesInScope])

  return (
    <NavigationContext.Provider
      value={{
        focusedId,
        activeScopeId,
        setFocusedId,
        registerFocusable,
        unregisterFocusable,
        setActiveScope,
        moveFocus,
      }}
    >
      {children}
    </NavigationContext.Provider>
  )
}
