import { Button, HorizontalList } from '@navix/react'
import { cn } from '@zenith-tv/ui/lib'
import { AlertTriangle } from 'lucide-react'
import type { ConfirmDialogProps } from './types'

export function ConfirmDialog({ title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-secondary rounded-2xl p-8 border border-border/20 shadow-2xl shadow-black/60">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-2.5 rounded-xl bg-destructive/10 shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{message}</p>
          </div>
        </div>

        <HorizontalList fKey="confirm-dialog-actions">
          <div className="flex gap-2">
            <Button fKey="confirm-delete" onClick={onConfirm} className="cursor-pointer flex-1">
              {({ focused }) => (
                <div className={cn(
                  'flex items-center justify-center py-3 rounded-xl text-sm font-bold transition-all duration-200',
                  'bg-destructive text-destructive-foreground',
                  focused && 'ring-2 ring-destructive/50',
                )}>
                  Sil
                </div>
              )}
            </Button>
            <Button fKey="confirm-cancel" onClick={onCancel} className="cursor-pointer">
              {({ focused }) => (
                <div className={cn(
                  'px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200',
                  'bg-muted text-muted-foreground',
                  focused && 'text-foreground ring-1 ring-border',
                )}>
                  İptal
                </div>
              )}
            </Button>
          </div>
        </HorizontalList>
      </div>
    </div>
  )
}
