import { forwardRef } from 'react'
import { Button, ButtonProps } from '@zenith-tv/ui/button'
import { cn } from '@zenith-tv/ui/lib/cn'
import { useFocusable } from '@/hooks/useFocusable'
import { useFocusScopeContext } from '@/contexts/FocusScope'

export interface FocusButtonProps extends Omit<ButtonProps, 'ref'> {
  focusId: string
  scopeId?: string
  onEnter?: () => void
  disabled?: boolean
}

export const FocusButton = forwardRef<HTMLButtonElement, FocusButtonProps>(
  ({ focusId, scopeId: scopeIdProp, onEnter, disabled, className, onClick, children, ...props }, forwardedRef) => {
    const scopeContext = useFocusScopeContext()
    const scopeId = scopeIdProp || scopeContext?.scopeId

    const { ref: focusRef, isFocused, focusProps } = useFocusable({
      focusId,
      scopeId,
      onEnter: onEnter || onClick as (() => void),
      disabled,
    })

    return (
      <Button
        ref={(node) => {
          // Merge refs
          if (typeof focusRef === 'function') focusRef(node)
          else if (focusRef) focusRef.current = node

          if (typeof forwardedRef === 'function') forwardedRef(node)
          else if (forwardedRef) forwardedRef.current = node
        }}
        {...focusProps}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          // Base transition
          'transition-all duration-200',
          // Focus styles - TV-optimized ring
          isFocused && [
            'ring-4 ring-white ring-offset-4 ring-offset-gray-900',
            'scale-105',
            'shadow-lg shadow-white/20',
          ],
          className
        )}
        {...props}
      >
        {children}
      </Button>
    )
  }
)

FocusButton.displayName = 'FocusButton'
