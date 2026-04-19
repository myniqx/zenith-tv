import { Plus, RefreshCw, X, User, Check } from 'lucide-react'
import { cn } from '@zenith-tv/ui/lib'
import { Button, VerticalList, HorizontalList } from '@navix/react'
import { useProfilesStore } from '@/stores/profiles'
import { useContentStore } from '@/stores/content'
import { M3UStatsPlaceholder } from './M3UStatsPlaceholder'

interface M3USourceListProps {
  selectedProfile: string | null
  syncingUUID: string | null
  showAddForm: boolean
  addUrl: string
  onAddUrlChange: (v: string) => void
  onSelectM3U: (username: string, uuid: string) => void
  onSyncM3U: (uuid: string) => void
  onDeleteM3U: (username: string, uuid: string) => void
  onAddM3U: () => void
  onAddSubmit: () => void
  onAddCancel: () => void
}

export function M3USourceList({
  selectedProfile,
  syncingUUID,
  showAddForm,
  addUrl,
  onAddUrlChange,
  onSelectM3U,
  onSyncM3U,
  onDeleteM3U,
  onAddM3U,
  onAddSubmit,
  onAddCancel,
}: M3USourceListProps) {
  const { profiles, getUrlFromUUID } = useProfilesStore()
  const { currentUUID } = useContentStore()
  const currentUsername = useProfilesStore(s => s.getCurrentUsername())

  const profile = profiles.find(p => p.username === selectedProfile)

  const getM3UDisplayName = (uuid: string): string => {
    const url = getUrlFromUUID(uuid)
    if (!url) return uuid.slice(0, 8)
    if (url.startsWith('file://')) {
      return url.replace('file://', '').split(/[/\\]/).pop() || uuid.slice(0, 8)
    }
    try {
      const urlObj = new URL(url)
      const filename = urlObj.pathname.split('/').pop()
      return filename || urlObj.hostname
    } catch {
      return url.slice(0, 30) + (url.length > 30 ? '...' : '')
    }
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <User className="w-14 h-14 mx-auto mb-4 opacity-10" />
          <p className="text-base text-muted-foreground/60">Soldaki listeden bir profil seçin</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden px-8 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight text-foreground">{profile.username}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{profile.m3uRefs.length} M3U kaynağı</p>
      </div>

      <VerticalList fKey="m3u-list">
        <div className="space-y-2 overflow-y-auto">
          {profile.m3uRefs.map((uuid) => {
            const isActive = currentUUID === uuid && currentUsername === selectedProfile

            return (
              <div key={uuid} className="flex items-center gap-2">
                <Button
                  fKey={`m3u-${uuid}`}
                  onClick={() => { if (!isActive) onSelectM3U(profile.username, uuid) }}
                  className="flex-1 cursor-pointer text-left"
                >
                  {({ focused }) => (
                    <div className={cn(
                      'flex items-center gap-3 px-5 py-4 rounded-xl bg-secondary transition-all duration-200',
                      isActive && 'border-l-2 border-primary',
                      focused && 'ring-1 ring-primary/40 bg-secondary/80',
                    )}>
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full shrink-0',
                        isActive ? 'bg-primary' : 'bg-transparent',
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          'text-sm font-semibold truncate',
                          focused || isActive ? 'text-foreground' : 'text-foreground/80',
                        )}>
                          {getM3UDisplayName(uuid)}
                        </p>
                        <div className="mt-1">
                          <M3UStatsPlaceholder uuid={uuid} />
                        </div>
                      </div>
                    </div>
                  )}
                </Button>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    fKey={`sync-m3u-${uuid}`}
                    onClick={() => onSyncM3U(uuid)}
                    className="cursor-pointer"
                  >
                    {({ focused }) => (
                      <div className={cn(
                        'p-2.5 rounded-lg transition-colors duration-200',
                        focused ? 'text-primary bg-primary/10' : 'text-muted-foreground/50',
                      )}>
                        <RefreshCw className={cn('w-4 h-4', syncingUUID === uuid && 'animate-spin')} />
                      </div>
                    )}
                  </Button>
                  <Button
                    fKey={`delete-m3u-${uuid}`}
                    onClick={() => onDeleteM3U(profile.username, uuid)}
                    className="cursor-pointer"
                  >
                    {({ focused }) => (
                      <div className={cn(
                        'p-2.5 rounded-lg transition-colors duration-200',
                        focused ? 'text-destructive bg-destructive/10' : 'text-muted-foreground/50',
                      )}>
                        <X className="w-4 h-4" />
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            )
          })}

          {/* inline add form */}
          {showAddForm ? (
            <div className="px-5 py-4 rounded-xl bg-secondary border border-primary/30">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Yeni M3U Kaynağı
              </p>
              <VerticalList fKey="add-m3u-form">
                <input
                  type="url"
                  value={addUrl}
                  onChange={(e) => onAddUrlChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onAddSubmit()}
                  placeholder="https://example.com/playlist.m3u"
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border/30 text-foreground text-sm font-mono placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 mb-3"
                />
                <HorizontalList fKey="add-m3u-actions">
                  <div className="flex gap-2">
                    <Button fKey="submit-m3u" onClick={onAddSubmit} className="cursor-pointer flex-1">
                      {({ focused }) => (
                        <div className={cn(
                          'flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all duration-200',
                          'bg-primary text-primary-foreground',
                          focused && 'ring-2 ring-primary/50',
                        )}>
                          <Check className="w-4 h-4" />
                          Ekle
                        </div>
                      )}
                    </Button>
                    <Button fKey="cancel-m3u" onClick={onAddCancel} className="cursor-pointer">
                      {({ focused }) => (
                        <div className={cn(
                          'px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200',
                          'bg-muted text-muted-foreground',
                          focused && 'text-foreground ring-1 ring-border',
                        )}>
                          İptal
                        </div>
                      )}
                    </Button>
                  </div>
                </HorizontalList>
              </VerticalList>
            </div>
          ) : (
            <Button fKey="add-m3u" onClick={onAddM3U} className="w-full cursor-pointer">
              {({ focused }) => (
                <div className={cn(
                  'flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-dashed transition-all duration-200',
                  focused ? 'border-primary/60 text-primary bg-primary/5' : 'border-border/20 text-muted-foreground',
                )}>
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Yeni M3U Kaynağı</span>
                </div>
              )}
            </Button>
          )}
        </div>
      </VerticalList>
    </div>
  )
}
