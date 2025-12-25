import { Check } from 'lucide-react'
import type { AddM3UFormProps } from './types'

export function AddM3UForm({
  url,
  onUrlChange,
  onSubmit,
  onCancel,
}: AddM3UFormProps) {
  return (
    <div className="h-full bg-gray-900 text-white flex items-center justify-center">
      <div className="bg-gray-800 p-12 rounded-2xl max-w-2xl w-full">
        <h2 className="text-3xl font-bold mb-8">Yeni M3U Kaynağı Ekle</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-lg mb-3 text-gray-400">M3U URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://example.com/playlist.m3u"
              className="w-full px-6 py-4 bg-gray-900 border-2 border-gray-700 rounded-lg text-lg font-mono focus:border-red-600 focus:outline-none"
              autoFocus
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={onSubmit}
              disabled={!url.trim()}
              className="flex-1 px-8 py-5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-xl font-semibold transition-colors flex items-center justify-center gap-3"
            >
              <Check className="w-6 h-6" />
              Ekle
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
    </div>
  )
}
