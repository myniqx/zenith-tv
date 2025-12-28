import { useEffect, useRef } from 'react'
import { useNavigation } from '../contexts/NavigationContext'

interface UseFocusableOptions {
  focusId: string
  scopeId?: string
  onEnter?: () => void
  disabled?: boolean
}

export function useFocusable({ focusId, scopeId, onEnter, disabled = false }: UseFocusableOptions) {
  const elementRef = useRef<HTMLElement>(null)
  const { focusedId } = useNavigation()

  const isFocused = focusedId === focusId

  // Sadece data attributes set et
  useEffect(() => {
    const element = elementRef.current
    if (!element || disabled) return

    element.dataset.focusId = focusId
    if (scopeId) {
      element.dataset.focusScope = scopeId
    }

    return () => {
      delete element.dataset.focusId
      if (scopeId) {
        delete element.dataset.focusScope
      }
    }
  }, [focusId, scopeId, disabled])

  useEffect(() => {
    if (isFocused && onEnter) {
      const handleClick = () => {
        onEnter()
      }

      const element = elementRef.current
      if (element) {
        element.addEventListener('click', handleClick)
        return () => element.removeEventListener('click', handleClick)
      }
    }
  }, [isFocused, onEnter])

  return {
    ref: elementRef,
    isFocused,
    focusProps: {
      'data-focus-id': focusId,
      ...(scopeId && { 'data-focus-scope': scopeId }),
      tabIndex: isFocused ? 0 : -1,
    },
  }
}
