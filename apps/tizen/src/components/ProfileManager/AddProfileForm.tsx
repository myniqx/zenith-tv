import { Check } from 'lucide-react'
import { Button, VerticalList, HorizontalList } from '@navix/react'
import { cn } from '@zenith-tv/ui/lib'

interface AddProfileFormProps {
  username: string
  url: string
  onUsernameChange: (v: string) => void
  onUrlChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
}

export function AddProfileForm({
  username,
  url,
  onUsernameChange,
  onUrlChange,
  onSubmit,
  onCancel,
}: AddProfileFormProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden px-8 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight text-foreground">Yeni Profil</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Profil adı ve M3U kaynağı girin</p>
      </div>

      <div className="max-w-xl">
        <VerticalList fKey="add-profile-form">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">
                Kullanıcı Adı
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                placeholder="örn: ahmet"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border/20 text-foreground text-sm placeholder:text-muted-foreground/40 outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">
                M3U URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => onUrlChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                placeholder="https://example.com/playlist.m3u"
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border/20 text-foreground text-sm font-mono placeholder:text-muted-foreground/40 outline-none focus:border-primary/50"
              />
            </div>

            <HorizontalList fKey="add-profile-actions">
              <div className="flex gap-2 pt-2">
                <Button fKey="submit-profile" onClick={onSubmit} className="cursor-pointer flex-1">
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
    </div>
  )
}
