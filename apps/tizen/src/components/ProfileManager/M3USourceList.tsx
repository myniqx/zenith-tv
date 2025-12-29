import { useState, useEffect } from 'react'
import { Plus, RefreshCw, X, User } from 'lucide-react'
import { cn } from '@zenith-tv/ui/lib/cn'
import { FocusButton, FocusCard } from '@/components/Navigation'
import { CardContent } from '@zenith-tv/ui/card'
import { useProfilesStore } from '@/stores/profiles'
import { M3UStatsPlaceholder } from './M3UStatsPlaceholder'

interface M3USourceListProps {
  selectedProfile: string | null
  syncingUUID: string | null
  onSyncM3U: (uuid: string) => void
  onDeleteM3U: (username: string, uuid: string) => void
  onAddM3U: () => void
}

export function M3USourceList({
  selectedProfile,
  syncingUUID,
  onSyncM3U,
  onDeleteM3U,
  onAddM3U,
}: M3USourceListProps) {
  const { profiles, getUrlFromUUID } = useProfilesStore()
  const profile = profiles.find(p => p.username === selectedProfile)
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [selectedProfile])

  useEffect(() => {
    if (!profile) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.keyCode === 38) {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex(Math.max(0, selectedIndex - 1))
      }
      if (e.keyCode === 40) {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex(Math.min(profile.m3uRefs.length, selectedIndex + 1))
      }
      if (e.keyCode === 13) {
        e.preventDefault()
        e.stopPropagation()
        if (selectedIndex === profile.m3uRefs.length) {
          onAddM3U()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, profile, onAddM3U])

  const getM3UDisplayName = (uuid: string): string => {
    const url = getUrlFromUUID(uuid)
    if (!url) return uuid.slice(0, 8)

    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const filename = pathname.split('/').pop()
      return filename || urlObj.hostname
    } catch {
      return url.slice(0, 30) + (url.length > 30 ? '...' : '')
    }
  }

  if (!profile) {
    return (
      <div className="flex-1 p-6 flex flex-col">
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <User className="w-24 h-24 mx-auto mb-4 opacity-30" />
            <p className="text-xl">Profil seçin veya yeni profil oluşturun</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 flex flex-col">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">{profile.username}</h2>
        <p className="text-gray-400">
          {profile.m3uRefs.length} M3U kaynağı
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {profile.m3uRefs.map((uuid, index) => (
          <FocusCard
            key={uuid}
            focusId={`m3u-${uuid}`}
            className={cn(
              'bg-gray-800',
              selectedIndex === index && 'bg-red-600'
            )}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold flex-1">
                  {getM3UDisplayName(uuid)}
                </h3>

                {selectedIndex === index && (
                  <div className="flex gap-2">
                    <FocusButton
                      focusId={`sync-m3u-${uuid}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSyncM3U(uuid)
                      }}
                      variant="ghost"
                      size="icon"
                      disabled={syncingUUID === uuid}
                      className="p-2 hover:bg-red-700 rounded"
                      title="Senkronize et"
                    >
                      <RefreshCw className={cn(
                        'w-5 h-5',
                        syncingUUID === uuid && 'animate-spin'
                      )} />
                    </FocusButton>
                    <FocusButton
                      focusId={`delete-m3u-${uuid}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteM3U(profile.username, uuid)
                      }}
                      variant="ghost"
                      size="icon"
                      className="p-2 hover:bg-red-700 rounded"
                      title="Kaynağı kaldır"
                    >
                      <X className="w-5 h-5" />
                    </FocusButton>
                  </div>
                )}
              </div>

              <M3UStatsPlaceholder uuid={uuid} />
            </CardContent>
          </FocusCard>
        ))}

        <div
          onClick={onAddM3U}
          className={cn(
            'p-6 rounded-lg border-2 border-dashed transition-all cursor-pointer',
            'flex items-center justify-center gap-3',
            selectedIndex === profile.m3uRefs.length
              ? 'border-red-600 bg-red-600/20 scale-105'
              : 'border-gray-700 hover:border-gray-600'
          )}
        >
          <Plus className="w-6 h-6" />
          <span className="text-lg">Yeni M3U Kaynağı</span>
        </div>
      </div>
    </div>
  )
}
