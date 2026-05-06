import { useState } from 'react'
import { Check } from 'lucide-react'
import { VerticalList, HorizontalList } from '@navix/react'
import { NavButton } from '../ui/NavButton'
import { NavInput } from '../ui/NavInput'
import { useProfilesStore } from '@/stores/profiles'
import { useContentStore } from '@/stores/content'

interface AddProfileFormProps {
  onSuccess: (username: string) => void
  onCancel: () => void
}

export function AddProfileForm({ onSuccess, onCancel }: AddProfileFormProps) {
  const [username, setUsername] = useState('')
  const [url, setUrl] = useState('')

  const { createProfile, addM3UToProfile, selectProfile } = useProfilesStore()
  const { update } = useContentStore()

  const handleSubmit = async () => {
    if (!username.trim() || !url.trim()) return
    try {
      createProfile(username.trim())
      const uuid = addM3UToProfile(username.trim(), url.trim())
      await selectProfile(username.trim(), uuid)
      update()
      onSuccess(username.trim())
    } catch (error) {
      console.error('Failed to add profile:', error)
    }
  }

  return (
    <div className="w-full max-w-lg bg-secondary rounded-2xl p-8 border border-border/20 shadow-2xl shadow-black/60">
      <div className="mb-6">
        <h2 className="font-headline text-2xl font-black tracking-tight text-foreground">Yeni Profil</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Profil adı ve M3U kaynağı girin</p>
      </div>

      <VerticalList fKey="add-profile-form">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              Kullanıcı Adı
            </label>
            <NavInput
              fKey="input-username"
              value={username}
              onChange={setUsername}
              placeholder="örn: ahmet"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              M3U URL
            </label>
            <NavInput
              fKey="input-url"
              value={url}
              onChange={setUrl}
              placeholder="https://example.com/playlist.m3u"
              mono
            />
          </div>

          <HorizontalList fKey="add-profile-actions">
            <div className="flex gap-2 pt-2">
              <NavButton
                fKey="submit-profile"
                variant="primary"
                size="lg"
                icon={<Check className="w-4 h-4" />}
                onClick={handleSubmit}
                className="flex-1 justify-center"
              >
                Oluştur
              </NavButton>
              <NavButton
                fKey="cancel-profile"
                variant="secondary"
                size="lg"
                onClick={onCancel}
              >
                İptal
              </NavButton>
            </div>
          </HorizontalList>
        </div>
      </VerticalList>
    </div>
  )
}
