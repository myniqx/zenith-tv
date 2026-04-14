import { useState } from 'react'
import { Check } from 'lucide-react'
import { FocusButton, FocusInput } from '@/components/Navigation'
import { Card, CardContent } from '@zenith-tv/ui/card'
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
    <div className="h-full bg-background flex items-center justify-center p-8">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-10">
          <h2 className="text-2xl font-semibold text-foreground mb-8">Yeni M3U Kaynağı Ekle</h2>

          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium text-muted-foreground mb-3 block">M3U URL</Label>
              <FocusInput
                focusId="m3u-url-input"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onEnter={handleSubmit}
                placeholder="https://example.com/playlist.m3u"
                className="w-full text-base font-mono"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <FocusButton
                focusId="submit-m3u"
                onClick={handleSubmit}
                disabled={!url.trim()}
                className="flex-1 py-4 text-base font-semibold gap-2"
              >
                <Check className="w-5 h-5" />
                Ekle
              </FocusButton>
              <FocusButton
                focusId="cancel-m3u"
                onClick={onCancel}
                variant="secondary"
                className="px-8 py-4 text-base"
              >
                İptal
              </FocusButton>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
