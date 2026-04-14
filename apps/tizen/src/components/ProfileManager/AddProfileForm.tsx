import { useState } from 'react'
import { Check } from 'lucide-react'
import { FocusButton, FocusInput } from '@/components/Navigation'
import { Card, CardContent } from '@zenith-tv/ui/card'
import { Label } from '@zenith-tv/ui/label'

interface AddProfileFormProps {
  onSubmit: (username: string, url: string) => void
  onCancel: () => void
}

export function AddProfileForm({ onSubmit, onCancel }: AddProfileFormProps) {
  const [username, setUsername] = useState('')
  const [url, setUrl] = useState('')

  const handleSubmit = () => {
    if (!username.trim() || !url.trim()) return
    onSubmit(username.trim(), url.trim())
  }

  return (
    <div className="h-full bg-background flex items-center justify-center p-8">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-10">
          <h2 className="text-2xl font-semibold text-foreground mb-8">Yeni Profil Oluştur</h2>

          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium text-muted-foreground mb-3 block">Kullanıcı Adı</Label>
              <FocusInput
                focusId="username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="örn: ahmet"
                className="w-full text-base"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground mb-3 block">M3U URL</Label>
              <FocusInput
                focusId="url-input"
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
                focusId="submit-profile"
                onClick={handleSubmit}
                disabled={!username.trim() || !url.trim()}
                className="flex-1 py-4 text-base font-semibold gap-2"
              >
                <Check className="w-5 h-5" />
                Oluştur
              </FocusButton>
              <FocusButton
                focusId="cancel-profile"
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
