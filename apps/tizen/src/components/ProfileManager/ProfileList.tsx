import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@zenith-tv/ui/lib/cn'
import { FocusButton } from '@/components/Navigation'
import { Card, CardContent } from '@zenith-tv/ui/card'
import { useProfilesStore } from '@/stores/profiles'

interface ProfileListProps {
  onSelectProfile: (username: string | null) => void
  onDeleteProfile: (username: string) => void
  onAddProfile: () => void
}

export function ProfileList({
  onSelectProfile,
  onDeleteProfile,
  onAddProfile,
}: ProfileListProps) {
  const { profiles } = useProfilesStore()
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.keyCode === 38) {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex(Math.max(0, selectedIndex - 1))
      }
      if (e.keyCode === 40) {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex(Math.min(profiles.length, selectedIndex + 1))
      }
      if (e.keyCode === 13) {
        e.preventDefault()
        e.stopPropagation()
        if (selectedIndex < profiles.length) {
          onSelectProfile(profiles[selectedIndex].username)
        } else {
          onAddProfile()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, profiles, onSelectProfile, onAddProfile])

  useEffect(() => {
    if (selectedIndex < profiles.length) {
      onSelectProfile(profiles[selectedIndex].username)
    } else {
      onSelectProfile(null)
    }
  }, [selectedIndex, profiles, onSelectProfile])

  return (
    <div className="w-1/3 border-r border-gray-800 p-6 flex flex-col">
      <h2 className="text-xl font-semibold mb-4 text-gray-400">Profiller</h2>

      <div className="flex-1 overflow-y-auto space-y-3">
        {profiles.map((profile, index) => (
          <Card
            key={profile.username}
            className={cn(
              'bg-gray-800 transition-all',
              selectedIndex === index && 'bg-red-600 scale-105'
            )}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl font-semibold">{profile.username}</span>
                {selectedIndex === index && (
                  <FocusButton
                    focusId={`delete-profile-${profile.username}`}
                    onClick={() => onDeleteProfile(profile.username)}
                    variant="ghost"
                    size="icon"
                    className="p-2 hover:bg-red-700 rounded"
                    title="Profili sil"
                  >
                    <Trash2 className="w-5 h-5" />
                  </FocusButton>
                )}
              </div>
              <p className="text-gray-400">
                {profile.m3uRefs.length} kaynak
              </p>
            </CardContent>
          </Card>
        ))}

        <div
          onClick={onAddProfile}
          className={cn(
            'p-6 rounded-lg border-2 border-dashed transition-all cursor-pointer',
            'flex items-center justify-center gap-3',
            selectedIndex === profiles.length
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
