import { forwardRef } from 'react'
import { Input } from '@zenith-tv/ui/input'
import { cn } from '@zenith-tv/ui/lib/cn'
import { useFocusable } from '@/hooks/useFocusable'
import { useFocusScopeContext } from '@/contexts/FocusScope'

export interface FocusInputProps extends Omit<React.ComponentProps<'input'>, 'ref'> {
  focusId: string
  scopeId?: string
  onEnter?: () => void
  disabled?: boolean
}

export const FocusInput = forwardRef<HTMLInputElement, FocusInputProps>(
  ({ focusId, scopeId: scopeIdProp, onEnter, disabled, className, ...props }, forwardedRef) => {
    const scopeContext = useFocusScopeContext()
    const scopeId = scopeIdProp || scopeContext?.scopeId

    const { ref: focusRef, isFocused, focusProps } = useFocusable({
      focusId,
      scopeId,
      onEnter,
      disabled,
    })

    return (
      <Input
        ref={(node) => {
          // Merge refs
          if (typeof focusRef === 'function') focusRef(node)
          else if (focusRef) focusRef.current = node

          if (typeof forwardedRef === 'function') forwardedRef(node)
          else if (forwardedRef) forwardedRef.current = node
        }}
        {...focusProps}
        disabled={disabled}
        className={cn(
          // Base transition
          'transition-all duration-200',
          // Focus styles - TV-optimized ring
          isFocused && [
            'border-primary ring-0',
          ],
          className
        )}
        {...props}
      />
    )
  }
)

FocusInput.displayName = 'FocusInput'
