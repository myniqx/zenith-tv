import { useEffect, useState, useCallback } from 'react'

export type Direction = 'up' | 'down' | 'left' | 'right'

interface UseDpadNavigationOptions {
  onEnter?: (focusedId: string | null) => void
  onBack?: () => void
  initialFocusId?: string
}

export function useDpadNavigation(options: UseDpadNavigationOptions = {}) {
  const [focusedId, setFocusedId] = useState<string | null>(options.initialFocusId || null)

  const moveFocus = useCallback((direction: Direction) => {
    const focusables = Array.from(
      document.querySelectorAll('[data-focusable="true"]')
    ) as HTMLElement[]

    if (focusables.length === 0) return

    const currentElement = focusedId ? document.getElementById(focusedId) : null
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
    setFocusedId(nextElement.id)
    nextElement.focus()
  }, [focusedId])

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
        const focusedElement = focusedId ? document.getElementById(focusedId) : null
        if (focusedElement) {
          focusedElement.click()
          options.onEnter?.(focusedId)
        }
      } else if (action === 'back') {
        options.onBack?.()
      } else {
        moveFocus(action)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusedId, moveFocus, options])

  useEffect(() => {
    if (!focusedId) {
      const firstFocusable = document.querySelector('[data-focusable="true"]') as HTMLElement
      if (firstFocusable) {
        setFocusedId(firstFocusable.id)
        firstFocusable.focus()
      }
    }
  }, [focusedId])

  return { focusedId, setFocusedId, moveFocus }
}
