import { useState } from 'react'
import { Plus, RefreshCw, User, Check } from 'lucide-react'
import { cn } from '@zenith-tv/ui/lib'
import { Button, Input, VerticalList, HorizontalList, Expandable } from '@navix/react'
import { useProfilesStore } from '@/stores/profiles'
import { useContentStore } from '@/stores/content'
import { M3UStatsPlaceholder } from './M3UStatsPlaceholder'
import { ConfirmButton } from './ConfirmDialog'

interface M3USourceListProps {
  selectedProfile: string | null
  onPendingSelect: () => void
}

export function M3USourceList({ selectedProfile, onPendingSelect }: M3USourceListProps) {
  const { profiles, getUrlFromUUID, addM3UToProfile, removeM3UFromProfile, selectProfile } = useProfilesStore()
  const { currentUUID, update } = useContentStore()
  const currentUsername = useProfilesStore(s => s.getCurrentUsername())

  const [syncingUUID, setSyncingUUID] = useState<string | null>(null)
  const [addUrl, setAddUrl] = useState('')

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

  const handleSelectM3U = async (username: string, uuid: string) => {
    if (currentUUID === uuid && currentUsername === username) return
    onPendingSelect()
    await selectProfile(username, uuid)
  }

  const handleSyncM3U = async (uuid: string) => {
    setSyncingUUID(uuid)
    try {
      if (currentUUID !== uuid && selectedProfile) {
        await selectProfile(selectedProfile, uuid)
      }
      await update()
    } catch (error) {
      console.error('Failed to sync M3U:', error)
    } finally {
      setSyncingUUID(null)
    }
  }

  const handleAddM3USubmit = async (collapse: () => void) => {
    if (!selectedProfile || !addUrl.trim()) return
    try {
      const uuid = addM3UToProfile(selectedProfile, addUrl.trim())
      collapse()
      setAddUrl('')
      onPendingSelect()
      await selectProfile(selectedProfile, uuid)
      update()
    } catch (error) {
      console.error('Failed to add M3U:', error)
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
    <div className="flex-1 flex flex-col overflow-hidden px-8 py-8 relative">
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight text-foreground">{profile.username}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{profile.m3uRefs.length} M3U kaynağı</p>
      </div>

      <VerticalList fKey="m3u-list">
        <div className="space-y-2 overflow-y-auto">
          {profile.m3uRefs.map((uuid) => {
            const isActive = currentUUID === uuid && currentUsername === selectedProfile

            return (
              <HorizontalList fKey={uuid} key={uuid}>
                <div className="flex items-center gap-2">
                  <Button
                    fKey={`m3u-${uuid}`}
                    onClick={() => handleSelectM3U(profile.username, uuid)}
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
                    <Button fKey={`sync-m3u-${uuid}`} onClick={() => handleSyncM3U(uuid)} className="cursor-pointer">
                      {({ focused }) => (
                        <div className={cn(
                          'p-2.5 rounded-lg transition-colors duration-200',
                          focused ? 'text-primary bg-primary/10' : 'text-muted-foreground/50',
                        )}>
                          <RefreshCw className={cn('w-4 h-4', syncingUUID === uuid && 'animate-spin')} />
                        </div>
                      )}
                    </Button>
                    <ConfirmButton
                      fKey={`delete-m3u-${uuid}`}
                      title="M3U Kaynağını Sil"
                      message={`"${getM3UDisplayName(uuid)}" kaynağını bu profilden kaldırmak istiyor musunuz?`}
                      onConfirm={async () => {
                        if (!selectedProfile) return
                        try {
                          await removeM3UFromProfile(selectedProfile, uuid)
                        } catch (error) {
                          console.error('Failed to delete M3U:', error)
                        }
                      }}
                    />
                  </div>
                </div>
              </HorizontalList>
            )
          })}

          <Expandable fKey="add-m3u">
            {({ isExpanded, directlyFocused, collapse }) => (
              <>
                <div className={cn(
                  'flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-dashed transition-all duration-200 cursor-pointer',
                  directlyFocused ? 'border-primary/60 text-primary bg-primary/5' : 'border-border/20 text-muted-foreground',
                )}>
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Yeni M3U Kaynağı</span>
                </div>

                {isExpanded && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-secondary rounded-2xl p-8 border border-border/20 shadow-2xl shadow-black/60">
                      <h2 className="text-2xl font-black tracking-tight text-foreground mb-1">Yeni M3U Kaynağı</h2>
                      <p className="text-sm text-muted-foreground mb-6">M3U playlist URL'sini girin</p>
                      <VerticalList fKey="add-m3u-form">
                        <Input
                          fKey="input-m3u-url"
                          value={addUrl}
                          onChange={setAddUrl}
                          className="mb-4"
                        >
                          {({ value, focused, editing, inputRef }) => (
                            <input
                              ref={inputRef}
                              value={value}
                              onChange={(e) => setAddUrl(e.target.value)}
                              placeholder="https://example.com/playlist.m3u"
                              className={cn(
                                'w-full px-4 py-3 rounded-xl bg-background text-foreground text-sm font-mono placeholder:text-muted-foreground/40 outline-none border mb-4',
                                editing ? 'border-primary/50' : focused ? 'border-border/50' : 'border-border/20',
                              )}
                            />
                          )}
                        </Input>
                        <HorizontalList fKey="add-m3u-actions">
                          <div className="flex gap-2">
                            <Button fKey="submit-m3u" onClick={() => handleAddM3USubmit(collapse)} className="cursor-pointer flex-1">
                              {({ focused }) => (
                                <div className={cn(
                                  'flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200',
                                  'bg-primary text-primary-foreground',
                                  focused && 'ring-2 ring-primary/50',
                                )}>
                                  <Check className="w-4 h-4" />
                                  Ekle
                                </div>
                              )}
                            </Button>
                            <Button fKey="cancel-m3u" onClick={() => { collapse(); setAddUrl('') }} className="cursor-pointer">
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
                      </VerticalList>
                    </div>
                  </div>
                )}
              </>
            )}
          </Expandable>
        </div>
      </VerticalList>

    </div>
  )
}
