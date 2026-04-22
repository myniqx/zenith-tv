import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@zenith-tv/ui/lib'
import { Button, HorizontalList, Input, VerticalList } from '@navix/react'
import { useProfilesStore } from '@/stores/profiles'
import { useContentStore } from '@/stores/content'
import { ConfirmButton } from './ConfirmDialog'
import type { Profile } from '@/stores/profiles'

interface M3UModalProps {
  profile: Profile
  onClose: () => void
  onPendingSelect: () => void
}

export function M3UModal({ profile, onClose, onPendingSelect }: M3UModalProps) {
  const { getUrlFromUUID, addM3UToProfile, removeM3UFromProfile, selectProfile } = useProfilesStore()
  const { currentUUID, update } = useContentStore()
  const currentUsername = useProfilesStore(s => s.getCurrentUsername())

  const [syncingUUID, setSyncingUUID] = useState<string | null>(null)
  const [addUrl, setAddUrl] = useState('')

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

  const handleSelect = async (uuid: string) => {
    if (currentUUID === uuid && currentUsername === profile.username) return
    onPendingSelect()
    await selectProfile(profile.username, uuid)
  }

  const handleSync = async (uuid: string) => {
    setSyncingUUID(uuid)
    try {
      if (currentUUID !== uuid || currentUsername !== profile.username) {
        await selectProfile(profile.username, uuid)
      }
      await update()
    } catch (error) {
      console.error('Failed to sync M3U:', error)
    } finally {
      setSyncingUUID(null)
    }
  }

  const handleAdd = async () => {
    if (!addUrl.trim()) return
    try {
      const newUuid = addM3UToProfile(profile.username, addUrl.trim())
      setAddUrl('')
      onPendingSelect()
      await selectProfile(profile.username, newUuid)
      update()
    } catch (error) {
      console.error('Failed to add M3U:', error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-secondary rounded-2xl border border-border/20 shadow-2xl shadow-black/60 overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <h2 className="font-headline text-2xl font-black tracking-tight text-foreground">
            M3U Kaynakları
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{profile.username}</p>
        </div>

        <VerticalList fKey={`m3u-modal-${profile.username}`}>

          {/* M3U List */}
          {profile.m3uRefs.length > 0 && (
            <div className="px-6 pb-2">
              {profile.m3uRefs.map((uuid, index) => {
                const isCurrentM3U = currentUUID === uuid && currentUsername === profile.username

                return (
                  <div key={uuid}>
                    {index > 0 && <div className="h-px bg-border/20 mx-2" />}
                    <div className="flex items-center justify-between py-3 gap-4">

                      {/* Name + indicator */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          isCurrentM3U ? 'bg-primary' : 'bg-muted-foreground/30',
                        )} />
                        <p className={cn(
                          'text-sm truncate',
                          isCurrentM3U ? 'text-foreground font-semibold' : 'text-muted-foreground',
                        )}>
                          {getM3UDisplayName(uuid)}
                        </p>
                      </div>

                      {/* Actions */}
                      <HorizontalList fKey={`modal-m3u-actions-${uuid}`}>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button fKey={`modal-select-${uuid}`} onClick={() => handleSelect(uuid)}>
                            {({ focused }) => (
                              <span className={cn(
                                'px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200',
                                isCurrentM3U
                                  ? focused ? 'bg-primary text-primary-foreground scale-100' : 'bg-primary/80 text-primary-foreground scale-95'
                                  : focused ? 'bg-accent text-foreground scale-100' : 'bg-muted text-muted-foreground scale-95',
                              )}>
                                Seç
                              </span>
                            )}
                          </Button>

                          <Button fKey={`modal-sync-${uuid}`} onClick={() => handleSync(uuid)}>
                            {({ focused }) => (
                              <span className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200',
                                focused ? 'bg-accent text-foreground scale-100' : 'text-muted-foreground scale-95',
                              )}>
                                <RefreshCw className={cn('w-3 h-3', syncingUUID === uuid && 'animate-spin')} />
                                Güncelle
                              </span>
                            )}
                          </Button>

                          <ConfirmButton
                            fKey={`modal-delete-m3u-${uuid}`}
                            title="M3U Kaynağını Sil"
                            message={`"${getM3UDisplayName(uuid)}" kaynağını bu profilden kaldırmak istiyor musunuz?`}
                            onConfirm={async () => {
                              try {
                                await removeM3UFromProfile(profile.username, uuid)
                              } catch (error) {
                                console.error('Failed to delete M3U:', error)
                              }
                            }}
                          />
                        </div>
                      </HorizontalList>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-border/20 mx-6 my-2" />

          {/* Add URL Input */}
          <div className="px-6 py-4">
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Yeni M3U URL
            </label>
            <Input
              fKey={`modal-input-m3u-${profile.username}`}
              value={addUrl}
              onChange={setAddUrl}
            >
              {({ value, focused, editing, inputRef }) => (
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setAddUrl(e.target.value)}
                  placeholder="https://example.com/playlist.m3u"
                  className={cn(
                    'w-full px-4 py-3 rounded-xl bg-background text-foreground text-sm font-mono placeholder:text-muted-foreground/40 outline-none border',
                    editing ? 'border-primary/50' : focused ? 'border-border/50' : 'border-border/20',
                  )}
                />
              )}
            </Input>
          </div>

          {/* Bottom Actions */}
          <div className="px-6 pb-6">
            <HorizontalList fKey={`m3u-modal-actions-${profile.username}`}>
              <div className="flex gap-2 justify-end">
                <Button fKey={`modal-close-${profile.username}`} onClick={onClose}>
                  {({ focused }) => (
                    <span className={cn(
                      'px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 bg-muted text-muted-foreground',
                      focused ? 'text-foreground scale-100' : 'scale-95',
                    )}>
                      Kapat
                    </span>
                  )}
                </Button>
                <Button fKey={`modal-add-${profile.username}`} onClick={handleAdd}>
                  {({ focused }) => (
                    <span className={cn(
                      'px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 bg-primary text-primary-foreground',
                      focused ? 'scale-100' : 'scale-95',
                    )}>
                      Ekle
                    </span>
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
