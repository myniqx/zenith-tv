import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@zenith-tv/ui/lib'
import { HorizontalList, VerticalList } from '@navix/react'
import { NavButton } from '@zenith-tv/ui/nav-button'
import { NavInput } from '@zenith-tv/ui/nav-input'

import { useProfilesStore } from '@/stores/profiles'
import { useContentStore } from '@/stores/content'
import { ConfirmButton } from './ConfirmDialog'
import type { Profile } from '@/stores/profiles'

interface M3UModalProps {
  profile: Profile
  onClose: () => void
  onLoad: (uuid: string) => void
}

export function M3UModal({ profile, onClose, onLoad }: M3UModalProps) {
  const { getUrlFromUUID, addM3UToProfile, removeM3UFromProfile, selectProfile } = useProfilesStore()
  const { currentUUID, update } = useContentStore()
  const currentUsername = useProfilesStore(s => s.getCurrentUsername())

  const defaultUUID = profile.lastSelectedUUID ?? profile.m3uRefs[0] ?? null
  const [selectedUUID, setSelectedUUID] = useState<string | null>(defaultUUID)
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
      setSelectedUUID(newUuid)
    } catch (error) {
      console.error('Failed to add M3U:', error)
    }
  }

  const handleLoad = () => {
    if (!selectedUUID) return
    onLoad(selectedUUID)
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
                const isSelected = selectedUUID === uuid
                const isLoaded = currentUUID === uuid && currentUsername === profile.username

                return (
                  <div key={uuid}>
                    {index > 0 && <div className="h-px bg-border/20 mx-2" />}
                    <div className="flex items-center justify-between py-3 gap-4">

                      {/* Name + indicator */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-200',
                          isLoaded ? 'bg-primary' : isSelected ? 'bg-primary/40' : 'bg-muted-foreground/30',
                        )} />
                        <p className={cn(
                          'text-sm truncate transition-colors duration-200',
                          isSelected ? 'text-foreground font-semibold' : 'text-muted-foreground',
                        )}>
                          {getM3UDisplayName(uuid)}
                        </p>
                        {isLoaded && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
                            Yüklü
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <HorizontalList fKey={`modal-m3u-actions-${uuid}`}>
                        <div className="flex items-center gap-1 shrink-0">
                          <NavButton
                            fKey={`modal-select-${uuid}`}
                            variant="secondary"
                            active={isSelected}
                            onClick={() => setSelectedUUID(uuid)}
                          >
                            Seç
                          </NavButton>

                          <NavButton
                            fKey={`modal-sync-${uuid}`}
                            variant="ghost"
                            icon={<RefreshCw className={cn('w-4 h-4', syncingUUID === uuid && 'animate-spin')} />}
                            onClick={() => handleSync(uuid)}
                          >
                            Güncelle
                          </NavButton>

                          <ConfirmButton
                            fKey={`modal-delete-m3u-${uuid}`}
                            title="M3U Kaynağını Sil"
                            message={`"${getM3UDisplayName(uuid)}" kaynağını bu profilden kaldırmak istiyor musunuz?`}
                            onConfirm={async () => {
                              try {
                                await removeM3UFromProfile(profile.username, uuid)
                                if (selectedUUID === uuid) {
                                  setSelectedUUID(profile.m3uRefs.find(r => r !== uuid) ?? null)
                                }
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
            <NavInput
              fKey={`modal-input-m3u-${profile.username}`}
              value={addUrl}
              onChange={setAddUrl}
              placeholder="https://example.com/playlist.m3u"
              mono
            />
          </div>

          {/* Bottom Actions */}
          <div className="px-6 pb-6">
            <HorizontalList fKey={`m3u-modal-actions-${profile.username}`}>
              <div className="flex gap-2 justify-end">
                <NavButton fKey={`modal-close-${profile.username}`} variant="secondary" size="lg" onClick={onClose}>
                  Kapat
                </NavButton>
                <NavButton fKey={`modal-add-${profile.username}`} variant="secondary" size="lg" onClick={handleAdd}>
                  Ekle
                </NavButton>
                <NavButton
                  fKey={`modal-load-${profile.username}`}
                  variant="primary"
                  size="lg"
                  onClick={handleLoad}
                  disabled={!selectedUUID}
                >
                  Yükle
                </NavButton>
              </div>
            </HorizontalList>
          </div>

        </VerticalList>
      </div>
    </div>
  )
}
