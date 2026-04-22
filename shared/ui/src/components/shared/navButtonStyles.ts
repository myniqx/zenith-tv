export type NavButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
export type NavButtonSize = 'sm' | 'md' | 'lg'

const sizeClasses: Record<NavButtonSize, string> = {
  sm: 'px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest',
  md: 'px-5 py-2 rounded-full text-base font-bold uppercase tracking-widest',
  lg: 'px-7 py-3.5 rounded-xl text-lg font-bold',
}

export function getNavButtonStyles(
  variant: NavButtonVariant,
  focused: boolean,
  size: NavButtonSize = 'md',
  active?: boolean,
): string {
  const base = 'flex items-center gap-1.5 transition-all duration-200 cursor-pointer select-none'
  const s = sizeClasses[size]

  if (focused) {
    switch (variant) {
      case 'primary':     return `${base} ${s} bg-primary text-primary-foreground scale-100`
      case 'secondary':   return `${base} ${s} bg-accent text-foreground scale-100`
      case 'ghost':       return `${base} ${s} bg-accent text-foreground scale-100`
      case 'destructive': return `${base} ${s} bg-destructive text-destructive-foreground scale-100`
    }
  }

  if (active) {
    switch (variant) {
      case 'primary':     return `${base} ${s} bg-primary text-primary-foreground scale-95`
      case 'secondary':   return `${base} ${s} bg-primary text-primary-foreground scale-95`
      case 'ghost':       return `${base} ${s} bg-accent/60 text-foreground scale-95`
      case 'destructive': return `${base} ${s} bg-destructive/20 text-destructive scale-95`
    }
  }

  switch (variant) {
    case 'primary':     return `${base} ${s} bg-primary/80 text-primary-foreground scale-95`
    case 'secondary':   return `${base} ${s} bg-muted text-muted-foreground scale-95`
    case 'ghost':       return `${base} ${s} text-muted-foreground scale-95`
    case 'destructive': return `${base} ${s} text-muted-foreground/50 scale-95`
  }
}
