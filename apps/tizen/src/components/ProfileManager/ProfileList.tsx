import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@zenith-tv/ui/lib/cn'
import { useProfilesStore } from '@/stores/profiles'

interface ProfileListProps {
  selectedIndex: number
  isFocused: boolean
  onDeleteProfile: (username: string) => void
  onAddProfile: () => void
}

export function ProfileList({
  selectedIndex,
  isFocused,
  onDeleteProfile,
  onAddProfile,
}: ProfileListProps) {
  const { profiles } = useProfilesStore()

  return (
    <div className="w-1/3 border-r border-gray-800 p-6 flex flex-col">
      <h2 className="text-xl font-semibold mb-4 text-gray-400">Profiller</h2>

      <div className="flex-1 overflow-y-auto space-y-3">
        {profiles.map((profile, index) => (
          <div
            key={profile.username}
            data-focusable="true"
            className={cn(
              'p-6 rounded-lg transition-all cursor-pointer',
              isFocused && selectedIndex === index
                ? 'bg-red-600 scale-105'
                : 'bg-gray-800 hover:bg-gray-700'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl font-semibold">{profile.username}</span>
              {isFocused && selectedIndex === index && (
                <button
                  onClick={() => onDeleteProfile(profile.username)}
                  className="p-2 hover:bg-red-700 rounded"
                  title="Profili sil"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
            <p className="text-gray-400">
              {profile.m3uRefs.length} kaynak
            </p>
          </div>
        ))}

        <div
          data-focusable="true"
          onClick={onAddProfile}
          className={cn(
            'p-6 rounded-lg border-2 border-dashed transition-all cursor-pointer',
            'flex items-center justify-center gap-3',
            isFocused && selectedIndex === profiles.length
              ? 'border-red-600 bg-red-600/20 scale-105'
              : 'border-gray-700 hover:border-gray-600'
          )}
        >
          <Plus className="w-6 h-6" />
          <span className="text-lg">Yeni Profil</span>
        </div>
      </div>
    </div>
  )
}
