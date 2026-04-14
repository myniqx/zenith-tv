import { Plus, RefreshCw, X, User } from 'lucide-react'
import { cn } from '@zenith-tv/ui/lib/cn'
import { FocusCard, FocusButton } from '@/components/Navigation'
import { CardContent } from '@zenith-tv/ui/card'
import { useProfilesStore } from '@/stores/profiles'
import { useContentStore } from '@/stores/content'
import { M3UStatsPlaceholder } from './M3UStatsPlaceholder'

interface M3USourceListProps {
  selectedProfile: string | null
  syncingUUID: string | null
  onSelectM3U: (username: string, uuid: string) => void
  onSyncM3U: (uuid: string) => void
  onDeleteM3U: (username: string, uuid: string) => void
  onAddM3U: () => void
}

export function M3USourceList({
  selectedProfile,
  syncingUUID,
  onSelectM3U,
  onSyncM3U,
  onDeleteM3U,
  onAddM3U,
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
      <div className="flex-1 p-8 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <User className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg">Profil seçin veya yeni profil oluşturun</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 flex flex-col overflow-hidden">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">{profile.username}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {profile.m3uRefs.length} M3U kaynağı
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {profile.m3uRefs.map((uuid) => {
          const isActive = currentUUID === uuid && currentUsername === selectedProfile

          return (
            <FocusCard
              key={uuid}
              focusId={`m3u-${uuid}`}
              onEnter={() => { if (!isActive) onSelectM3U(profile.username, uuid) }}
              onClick={() => { if (!isActive) onSelectM3U(profile.username, uuid) }}
              className={cn(
                isActive
                  ? 'border-l-primary bg-primary/5 cursor-default'
                  : 'cursor-pointer'
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    )}
                    <span className={cn(
                      'font-medium truncate text-base',
                      isActive ? 'text-foreground' : 'text-foreground/80'
                    )}>
                      {getM3UDisplayName(uuid)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <FocusButton
                      focusId={`sync-m3u-${uuid}`}
                      onClick={(e) => { e.stopPropagation(); onSyncM3U(uuid) }}
                      variant="ghost"
                      size="icon"
                      focusStyle="highlight"
                      disabled={syncingUUID === uuid}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Senkronize et"
                    >
                      <RefreshCw className={cn('w-4 h-4', syncingUUID === uuid && 'animate-spin')} />
                    </FocusButton>
                    <FocusButton
                      focusId={`delete-m3u-${uuid}`}
                      onClick={(e) => { e.stopPropagation(); onDeleteM3U(profile.username, uuid) }}
                      variant="ghost"
                      size="icon"
                      focusStyle="highlight"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Kaynağı kaldır"
                    >
                      <X className="w-4 h-4" />
                    </FocusButton>
                  </div>
                </div>
                <div className="mt-2 ml-3.5">
                  <M3UStatsPlaceholder uuid={uuid} />
                </div>
              </CardContent>
            </FocusCard>
          )
        })}

        <FocusCard
          focusId="add-m3u"
          onEnter={onAddM3U}
          onClick={onAddM3U}
          className="border-dashed border-2 bg-transparent hover:bg-muted/30"
        >
          <CardContent className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
            <Plus className="w-4 h-4" />
            <span className="text-sm">Yeni M3U Kaynağı</span>
          </CardContent>
        </FocusCard>
      </div>
    </div>
  )
}
