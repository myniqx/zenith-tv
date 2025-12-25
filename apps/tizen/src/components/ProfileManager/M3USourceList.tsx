import { Plus, RefreshCw, X, User } from 'lucide-react'
import { cn } from '@zenith-tv/ui/lib/cn'
import { useProfilesStore } from '@/stores/profiles'
import { M3UStatsPlaceholder } from './M3UStatsPlaceholder'

interface M3USourceListProps {
  selectedProfileIndex: number
  selectedIndex: number
  isFocused: boolean
  syncingUUID: string | null
  onSyncM3U: (uuid: string) => void
  onDeleteM3U: (username: string, uuid: string) => void
  onAddM3U: () => void
}

export function M3USourceList({
  selectedProfileIndex,
  selectedIndex,
  isFocused,
  syncingUUID,
  onSyncM3U,
  onDeleteM3U,
  onAddM3U,
}: M3USourceListProps) {
  const { profiles, getUrlFromUUID } = useProfilesStore()
  const profile = profiles[selectedProfileIndex]

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
          <div
            key={uuid}
            data-focusable="true"
            className={cn(
              'p-6 rounded-lg transition-all cursor-pointer',
              isFocused && selectedIndex === index
                ? 'bg-red-600 scale-105'
                : 'bg-gray-800 hover:bg-gray-700'
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold flex-1">
                {getM3UDisplayName(uuid)}
              </h3>

              {isFocused && selectedIndex === index && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onSyncM3U(uuid)}
                    className="p-2 hover:bg-red-700 rounded"
                    disabled={syncingUUID === uuid}
                    title="Senkronize et"
                  >
                    <RefreshCw className={cn(
                      'w-5 h-5',
                      syncingUUID === uuid && 'animate-spin'
                    )} />
                  </button>
                  <button
                    onClick={() => onDeleteM3U(profile.username, uuid)}
                    className="p-2 hover:bg-red-700 rounded"
                    title="Kaynağı kaldır"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            <M3UStatsPlaceholder uuid={uuid} />
          </div>
        ))}

        <div
          data-focusable="true"
          onClick={onAddM3U}
          className={cn(
            'p-6 rounded-lg border-2 border-dashed transition-all cursor-pointer',
            'flex items-center justify-center gap-3',
            isFocused && selectedIndex === profile.m3uRefs.length
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
