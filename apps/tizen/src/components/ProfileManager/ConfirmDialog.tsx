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
          <button
            onClick={onConfirm}
            className="flex-1 px-8 py-5 bg-red-600 hover:bg-red-700 rounded-lg text-xl font-semibold transition-colors"
          >
            Sil
          </button>
          <button
            onClick={onCancel}
            className="px-8 py-5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xl transition-colors"
          >
            İptal
          </button>
        </div>
      </div>
    </div>
  )
}
