import { Button } from '@navix/react'
import { cn } from '../../lib/cn'
import type { ReactNode } from 'react'
import { getNavButtonStyles } from './navButtonStyles'
import type { NavButtonVariant, NavButtonSize } from './navButtonStyles'

export type { NavButtonVariant, NavButtonSize }

interface NavButtonProps {
  fKey: string
  onClick?: () => void
  onLongPress?: () => void
  variant?: NavButtonVariant
  size?: NavButtonSize
  active?: boolean
  disabled?: boolean
  className?: string
  icon?: ReactNode
  children?: ReactNode
}

export function NavButton({
  fKey,
  onClick,
  onLongPress,
  variant = 'secondary',
  size = 'md',
  active = false,
  disabled = false,
  className,
  icon,
  children,
}: NavButtonProps) {
  return (
    <Button fKey={fKey} onClick={disabled ? undefined : onClick} onLongPress={onLongPress}>
      {({ focused }) => (
        <span className={cn(
          getNavButtonStyles(variant, focused, size, active),
          disabled && 'opacity-40 pointer-events-none',
          className,
        )}>
          {icon}
          {children}
        </span>
      )}
    </Button>
  )
}
