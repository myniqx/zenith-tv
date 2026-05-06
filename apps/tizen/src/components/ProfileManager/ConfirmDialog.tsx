import { Expandable, HorizontalList } from '@navix/react'
import { NavButton } from '../ui/NavButton'
import { getNavButtonStyles } from '../ui/navButtonStyles'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface ConfirmButtonProps {
  fKey: string
  title: string
  message: string
  onConfirm: () => void
  trigger?: (focused: boolean) => React.ReactNode
}

export function ConfirmButton({ fKey, title, message, onConfirm, trigger }: ConfirmButtonProps) {
  return (
    <Expandable fKey={fKey}>
      {({ isExpanded, directlyFocused, collapse }) => (
        <>
          {trigger ? (
            trigger(directlyFocused)
          ) : (
            <span className={getNavButtonStyles('destructive', directlyFocused, 'md')}>
              <Trash2 className="w-5 h-5" />
            </span>
          )}

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
                    <NavButton
                      fKey={`${fKey}-confirm`}
                      variant="destructive"
                      size="lg"
                      onClick={() => { onConfirm(); collapse() }}
                      className="flex-1 justify-center"
                    >
                      Sil
                    </NavButton>
                    <NavButton
                      fKey={`${fKey}-cancel`}
                      variant="secondary"
                      size="lg"
                      onClick={collapse}
                    >
                      İptal
                    </NavButton>
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
