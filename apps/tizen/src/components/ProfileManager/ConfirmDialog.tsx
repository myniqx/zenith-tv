import { FocusButton } from '@/components/Navigation'
import type { ConfirmDialogProps } from './types'

export function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="h-full bg-gray-900/95 text-white flex items-center justify-center">
      <div className="bg-gray-800 p-12 rounded-2xl max-w-2xl w-full">
        <h2 className="text-3xl font-bold mb-6">{title}</h2>
        <p className="text-xl text-gray-300 mb-8 leading-relaxed">{message}</p>

        <div className="flex gap-4">
          <FocusButton
            focusId="confirm-delete"
            onClick={onConfirm}
            variant="destructive"
            className="flex-1 px-8 py-5 text-xl font-semibold"
          >
            Sil
          </FocusButton>
          <FocusButton
            focusId="confirm-cancel"
            onClick={onCancel}
            variant="secondary"
            className="px-8 py-5 text-xl"
          >
            İptal
          </FocusButton>
        </div>
      </div>
    </div>
  )
}
