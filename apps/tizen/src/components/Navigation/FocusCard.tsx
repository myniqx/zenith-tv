import { forwardRef } from 'react'
import { Card } from '@zenith-tv/ui/card'
import { cn } from '@zenith-tv/ui/lib/cn'
import { useFocusable } from '@/hooks/useFocusable'
import { useFocusScopeContext } from '@/contexts/FocusScope'

export interface FocusCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'ref'> {
  focusId: string
  scopeId?: string
  onEnter?: () => void
  disabled?: boolean
  asChild?: boolean
}

export const FocusCard = forwardRef<HTMLDivElement, FocusCardProps>(
  ({ focusId, scopeId: scopeIdProp, onEnter, disabled, className, onClick, children, ...props }, forwardedRef) => {
    const scopeContext = useFocusScopeContext()
    const scopeId = scopeIdProp || scopeContext?.scopeId

    const { ref: focusRef, isFocused, focusProps } = useFocusable({
      focusId,
      scopeId,
      onEnter: onEnter || (onClick as (() => void)),
      disabled,
    })

    return (
      <Card
        ref={(node) => {
          // Merge refs
          if (typeof focusRef === 'function') focusRef(node)
          else if (focusRef) focusRef.current = node

          if (typeof forwardedRef === 'function') forwardedRef(node)
          else if (forwardedRef) forwardedRef.current = node
        }}
        {...focusProps}
        onClick={onClick}
        className={cn(
          // Base transition and cursor
          'transition-all duration-200 cursor-pointer',
          // Focus styles - TV-optimized ring
          isFocused && [
            'ring-4 ring-white ring-offset-4 ring-offset-gray-900',
            'scale-105',
            'shadow-lg shadow-white/20',
            'border-white',
          ],
          // Disabled state
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        {children}
      </Card>
    )
  }
)

FocusCard.displayName = 'FocusCard'
