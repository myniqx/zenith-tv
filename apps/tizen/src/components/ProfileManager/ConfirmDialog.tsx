import { Expandable } from '@navix/react'
import { Button, HorizontalList } from '@navix/react'
import { cn } from '@zenith-tv/ui/lib'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface ConfirmButtonProps {
  fKey: string
  title: string
  message: string
  onConfirm: () => void
  /** Trigger button görünümünü özelleştirmek için — varsayılan: çöp kutusu ikonu */
  trigger?: (focused: boolean) => React.ReactNode
}

export function ConfirmButton({ fKey, title, message, onConfirm, trigger }: ConfirmButtonProps) {
  return (
    <Expandable fKey={fKey}>
      {({ isExpanded, directlyFocused, collapse }) => (
        <>
          {/* trigger */}
          {trigger ? (
            trigger(directlyFocused)
          ) : (
            <div className={cn(
              'p-2 rounded-lg transition-colors duration-200 cursor-pointer',
              directlyFocused ? 'text-destructive bg-destructive/10' : 'text-muted-foreground/40',
            )}>
              <Trash2 className="w-3.5 h-3.5" />
            </div>
          )}

          {/* overlay */}
          {isExpanded && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="w-full max-w-lg bg-secondary rounded-2xl p-8 border border-border/20 shadow-2xl shadow-black/60">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-2.5 rounded-xl bg-destructive/10 shrink-0">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <h2 className="font-headline text-lg font-black tracking-tight text-foreground">{title}</h2>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{message}</p>
                  </div>
                </div>

                <HorizontalList fKey={`${fKey}-actions`}>
                  <div className="flex gap-2">
                    <Button
                      fKey={`${fKey}-confirm`}
                      onClick={() => { onConfirm(); collapse() }}
                      className="cursor-pointer flex-1"
                    >
                      {({ focused }) => (
                        <div className={cn(
                          'flex items-center justify-center py-3 rounded-xl text-sm font-bold transition-all duration-200',
                          'bg-destructive text-destructive-foreground',
                          focused && 'ring-2 ring-destructive/50 scale-105',
                        )}>
                          Sil
                        </div>
                      )}
                    </Button>
                    <Button
                      fKey={`${fKey}-cancel`}
                      onClick={collapse}
                      className="cursor-pointer"
                    >
                      {({ focused }) => (
                        <div className={cn(
                          'px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200',
                          'bg-muted text-muted-foreground',
                          focused && 'text-foreground ring-1 ring-border scale-105',
                        )}>
                          İptal
                        </div>
                      )}
                    </Button>
                  </div>
                </HorizontalList>
              </div>
            </div>
          )}
        </>
      )}
    </Expandable>
  )
}
