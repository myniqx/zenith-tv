import { Plus } from 'lucide-react'
import { cn } from '@zenith-tv/ui/lib'
import { Button, VerticalList, Expandable, HorizontalList } from '@navix/react'
import { useProfilesStore } from '@/stores/profiles'
import { ConfirmButton } from './ConfirmDialog'
import { AddProfileForm } from './AddProfileForm'
import { useMemo } from 'react'

interface ProfileListProps {
  selectedProfile: string | null
  onSelectProfile: (username: string) => void
  onDeleted: () => void
  onAdded: (username: string) => void
}

export function ProfileList({
  selectedProfile,
  onSelectProfile,
  onDeleted,
  onAdded,
}: ProfileListProps) {
  const { profiles, getCurrentUsername, deleteProfile } = useProfilesStore()
  const currentUsername = getCurrentUsername()

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0)),
    [profiles],
  )

  return (
    <div className="w-72 shrink-0 bg-muted flex flex-col overflow-hidden relative">
      <div className="px-6 pt-8 pb-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Profiller
        </h2>
      </div>

      <VerticalList fKey="profile-list">
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          {sortedProfiles.map((profile) => {
            const isActive = currentUsername === profile.username
            const isSelected = selectedProfile === profile.username

            return (
              <HorizontalList fKey={profile.createdAt.toString()}>
                <div key={profile.username} className="flex items-center gap-1">
                  <Button
                    fKey={`profile-${profile.username}`}
                    onClick={() => onSelectProfile(profile.username)}
                    className="flex-1 cursor-pointer text-left"
                  >
                    {({ focused }) => (
                      <div className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                        isSelected ? 'bg-secondary' : 'bg-transparent',
                        focused && 'bg-secondary ring-1 ring-primary/40',
                      )}>
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-200',
                          isActive ? 'bg-primary' : 'bg-transparent',
                        )} />
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            'text-sm font-semibold truncate',
                            focused || isSelected ? 'text-foreground' : 'text-foreground/70',
                          )}>
                            {profile.username}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {profile.m3uRefs.length} kaynak
                            {isActive && (
                              <span className="ml-2 text-primary font-semibold">• Aktif</span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </Button>

                  <ConfirmButton
                    fKey={`delete-profile-${profile.username}`}
                    title="Profili Sil"
                    message={`"${profile.username}" profilini ve tüm verilerini kalıcı olarak silmek istiyor musunuz?`}
                    onConfirm={async () => {
                      try {
                        await deleteProfile(profile.username)
                        onDeleted()
                      } catch (error) {
                        console.error('Failed to delete profile:', error)
                      }
                    }}
                  />
                </div>
              </HorizontalList>
            )
          })}

          <Expandable fKey="add-profile">
            {({ isExpanded, directlyFocused, collapse }) => (
              <>
                <div className={cn(
                  'flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed transition-all duration-200 cursor-pointer',
                  directlyFocused ? 'border-primary/60 text-primary bg-primary/5' : 'border-border/30 text-muted-foreground',
                )}>
                  <Plus className="w-3.5 h-3.5" />
                  <span className="text-sm font-medium">Yeni Profil</span>
                </div>

                {isExpanded && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <AddProfileForm
                      onSuccess={(username) => { collapse(); onAdded(username) }}
                      onCancel={collapse}
                    />
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
