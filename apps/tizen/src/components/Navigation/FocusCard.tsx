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
          'transition-all duration-150 cursor-pointer',
          'border-l-4 border-l-transparent',
          isFocused && [
            'border-l-primary bg-muted/60',
          ],
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
