import { FocusButton } from '@/components/Navigation'
import { Card, CardContent } from '@zenith-tv/ui/card'
import type { ConfirmDialogProps } from './types'

export function ConfirmDialog({ title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="h-full bg-background flex items-center justify-center p-8">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">{title}</h2>
          <p className="text-base text-muted-foreground mb-8 leading-relaxed">{message}</p>

          <div className="flex gap-3">
            <FocusButton
              focusId="confirm-delete"
              onClick={onConfirm}
              variant="destructive"
              className="flex-1 py-4 text-base font-semibold"
            >
              Sil
            </FocusButton>
            <FocusButton
              focusId="confirm-cancel"
              onClick={onCancel}
              variant="secondary"
              className="px-8 py-4 text-base"
            >
              İptal
            </FocusButton>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
