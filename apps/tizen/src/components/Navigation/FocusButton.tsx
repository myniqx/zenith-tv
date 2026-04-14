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
  focusStyle?: 'ring' | 'highlight'
}

export const FocusButton = forwardRef<HTMLButtonElement, FocusButtonProps>(
  ({ focusId, scopeId: scopeIdProp, onEnter, disabled, focusStyle = 'ring', className, onClick, children, ...props }, forwardedRef) => {
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
          if (typeof focusRef === 'function') focusRef(node)
          else if (focusRef) focusRef.current = node

          if (typeof forwardedRef === 'function') forwardedRef(node)
          else if (forwardedRef) forwardedRef.current = node
        }}
        {...focusProps}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'transition-all duration-150',
          isFocused && focusStyle === 'ring' && [
            'ring-2 ring-primary/70 ring-offset-1 ring-offset-background',
          ],
          isFocused && focusStyle === 'highlight' && [
            'bg-muted text-foreground',
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
