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
  const { focusedId, setFocusedId } = useNavigation()

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

  // Mouse/Input olaylarını dinle ve focus state ile senkronize et
  useEffect(() => {
    const element = elementRef.current
    if (!element || disabled) return

    const handleMouseEnter = () => {
      // Mouse üzerine geldiğinde focus'u güncelle ama scroll yapma (zaten oradayız)
      setFocusedId(focusId, true)
    }

    const handleClick = () => {
      // Tıklayınca önce focusla, sonra işlemi yap
      setFocusedId(focusId, true)
      if (onEnter) {
        onEnter()
      }
    }

    element.addEventListener('mouseenter', handleMouseEnter)
    element.addEventListener('click', handleClick)

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter)
      element.removeEventListener('click', handleClick)
    }
  }, [disabled, focusId, setFocusedId, onEnter])

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
