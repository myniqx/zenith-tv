import { useEffect, useRef } from 'react'
import { useNavigation, FocusableElement } from '../contexts/NavigationContext'

interface UseFocusableOptions {
  focusId: string
  scopeId?: string
  onEnter?: () => void
  disabled?: boolean
}

export function useFocusable({ focusId, scopeId, onEnter, disabled = false }: UseFocusableOptions) {
  const elementRef = useRef<HTMLElement>(null)
  const { focusedId, registerFocusable, unregisterFocusable } = useNavigation()

  const isFocused = focusedId === focusId

  useEffect(() => {
    const element = elementRef.current
    if (!element || disabled) return

    const focusableElement = element as FocusableElement
    focusableElement.dataset.focusId = focusId

    registerFocusable(focusId, focusableElement, scopeId)

    return () => {
      unregisterFocusable(focusId)
    }
  }, [focusId, scopeId, registerFocusable, unregisterFocusable, disabled])

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
