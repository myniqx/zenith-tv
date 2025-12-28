import { useState } from 'react'
import { Check } from 'lucide-react'
import { FocusButton, FocusInput } from '@/components/Navigation'
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
    <div className="h-full bg-gray-900 text-white flex items-center justify-center">
      <div className="bg-gray-800 p-12 rounded-2xl max-w-2xl w-full">
        <h2 className="text-3xl font-bold mb-8">Yeni Profil Oluştur</h2>

        <div className="space-y-6">
          <div>
            <Label className="block text-lg mb-3 text-gray-400">Kullanıcı Adı</Label>
            <FocusInput
              focusId="username-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="örn: ahmet"
              className="w-full px-6 py-4 bg-gray-900 border-2 border-gray-700 rounded-lg text-xl"
            />
          </div>

          <div>
            <Label className="block text-lg mb-3 text-gray-400">M3U URL</Label>
            <FocusInput
              focusId="url-input"
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
              focusId="submit-profile"
              onClick={handleSubmit}
              disabled={!username.trim() || !url.trim()}
              className="flex-1 px-8 py-5 text-xl font-semibold flex items-center justify-center gap-3"
            >
              <Check className="w-6 h-6" />
              Oluştur
            </FocusButton>
            <FocusButton
              focusId="cancel-profile"
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
