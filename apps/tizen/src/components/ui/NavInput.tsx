import { Input } from '@navix/react'
import { cn } from '../../lib/cn'

interface NavInputProps {
  fKey: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  mono?: boolean
}

const base = 'w-full px-4 py-3 rounded-xl bg-background text-foreground text-sm placeholder:text-muted-foreground/40 outline-none border transition-colors duration-200'

export function NavInput({ fKey, value, onChange, placeholder, className, mono }: NavInputProps) {
  return (
    <Input fKey={fKey} value={value} onChange={onChange}>
      {({ value, focused, editing, inputRef }) => (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            base,
            mono && 'font-mono',
            editing ? 'border-primary/50' : focused ? 'border-border/50' : 'border-border/20',
            className,
          )}
        />
      )}
    </Input>
  )
}
