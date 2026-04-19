import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button, Input, VerticalList, HorizontalList } from '@navix/react'
import { cn } from '@zenith-tv/ui/lib'
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

  const inputBase = 'w-full px-4 py-3 rounded-xl bg-background text-foreground text-sm placeholder:text-muted-foreground/40 outline-none border'

  return (
    <div className="w-full max-w-lg bg-secondary rounded-2xl p-8 border border-border/20 shadow-2xl shadow-black/60">
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight text-foreground">Yeni Profil</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Profil adı ve M3U kaynağı girin</p>
      </div>

      <VerticalList fKey="add-profile-form">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              Kullanıcı Adı
            </label>
            <Input
              fKey="input-username"
              value={username}
              onChange={setUsername}
              className={cn(inputBase, 'border-border/20')}
              focusedClassName={cn(inputBase, 'border-border/50')}
              editingClassName={cn(inputBase, 'border-primary/50')}
            >
              {({ value, focused, editing, inputRef }) => (
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="örn: ahmet"
                  className={cn(
                    inputBase,
                    editing ? 'border-primary/50' : focused ? 'border-border/50' : 'border-border/20',
                  )}
                />
              )}
            </Input>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              M3U URL
            </label>
            <Input
              fKey="input-url"
              value={url}
              onChange={setUrl}
            >
              {({ value, focused, editing, inputRef }) => (
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/playlist.m3u"
                  className={cn(
                    inputBase, 'font-mono',
                    editing ? 'border-primary/50' : focused ? 'border-border/50' : 'border-border/20',
                  )}
                />
              )}
            </Input>
          </div>

          <HorizontalList fKey="add-profile-actions">
            <div className="flex gap-2 pt-2">
              <Button fKey="submit-profile" onClick={handleSubmit} className="cursor-pointer flex-1">
                {({ focused }) => (
                  <div className={cn(
                    'flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200',
                    'bg-primary text-primary-foreground',
                    focused && 'ring-2 ring-primary/50',
                  )}>
                    <Check className="w-4 h-4" />
                    Oluştur
                  </div>
                )}
              </Button>
              <Button fKey="cancel-profile" onClick={onCancel} className="cursor-pointer">
                {({ focused }) => (
                  <div className={cn(
                    'px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200',
                    'bg-muted text-muted-foreground',
                    focused && 'text-foreground ring-1 ring-border',
                  )}>
                    İptal
                  </div>
                )}
              </Button>
            </div>
          </HorizontalList>
        </div>
      </VerticalList>
    </div>
  )
}
