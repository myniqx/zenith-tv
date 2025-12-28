import { useState } from 'react'
import { Check } from 'lucide-react'
import { FocusButton, FocusInput } from '@/components/Navigation'
import { Label } from '@zenith-tv/ui/label'

interface AddM3UFormProps {
  onSubmit: (url: string) => void
  onCancel: () => void
}

export function AddM3UForm({ onSubmit, onCancel }: AddM3UFormProps) {
  const [url, setUrl] = useState('')

  const handleSubmit = () => {
    if (!url.trim()) return
    onSubmit(url.trim())
  }

  return (
    <div className="h-full bg-gray-900 text-white flex items-center justify-center">
      <div className="bg-gray-800 p-12 rounded-2xl max-w-2xl w-full">
        <h2 className="text-3xl font-bold mb-8">Yeni M3U Kaynağı Ekle</h2>

        <div className="space-y-6">
          <div>
            <Label className="block text-lg mb-3 text-gray-400">M3U URL</Label>
            <FocusInput
              focusId="m3u-url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onEnter={handleSubmit}
              placeholder="https://example.com/playlist.m3u"
              className="w-full px-6 py-4 bg-gray-900 border-2 border-gray-700 rounded-lg text-lg font-mono"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <FocusButton
              focusId="submit-m3u"
              onClick={handleSubmit}
              disabled={!url.trim()}
              className="flex-1 px-8 py-5 text-xl font-semibold flex items-center justify-center gap-3"
            >
              <Check className="w-6 h-6" />
              Ekle
            </FocusButton>
            <FocusButton
              focusId="cancel-m3u"
              onClick={onCancel}
              variant="secondary"
              className="px-8 py-5 text-xl"
            >
              İptal
            </FocusButton>
          </div>
        </div>
      </div>
    </div>
  )
}
