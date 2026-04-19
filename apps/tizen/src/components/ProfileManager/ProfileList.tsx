import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@zenith-tv/ui/lib'
import { Button, VerticalList } from '@navix/react'
import type { Profile } from '@/stores/profiles'

interface ProfileListProps {
  profiles: Profile[]
  selectedProfile: string | null
  currentUsername: string | null
  onSelectProfile: (username: string) => void
  onDeleteProfile: (username: string) => void
  onAddProfile: () => void
}

export function ProfileList({
  profiles,
  selectedProfile,
  currentUsername,
  onSelectProfile,
  onDeleteProfile,
  onAddProfile,
}: ProfileListProps) {
  return (
    <div className="w-72 shrink-0 bg-muted flex flex-col overflow-hidden">
      <div className="px-6 pt-8 pb-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Profiller
        </h2>
      </div>

      <VerticalList fKey="profile-list">
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          {profiles.map((profile) => {
            const isActive = currentUsername === profile.username
            const isSelected = selectedProfile === profile.username

            return (
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

                <Button
                  fKey={`delete-profile-${profile.username}`}
                  onClick={() => onDeleteProfile(profile.username)}
                  className="cursor-pointer shrink-0"
                >
                  {({ focused }) => (
                    <div className={cn(
                      'p-2 rounded-lg transition-colors duration-200',
                      focused ? 'text-destructive bg-destructive/10' : 'text-muted-foreground/40',
                    )}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </div>
                  )}
                </Button>
              </div>
            )
          })}

          <Button
            fKey="add-profile"
            onClick={onAddProfile}
            className="w-full cursor-pointer"
          >
            {({ focused }) => (
              <div className={cn(
                'flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed transition-all duration-200',
                focused ? 'border-primary/60 text-primary bg-primary/5' : 'border-border/30 text-muted-foreground',
              )}>
                <Plus className="w-3.5 h-3.5" />
                <span className="text-sm font-medium">Yeni Profil</span>
              </div>
            )}
          </Button>
        </div>
      </VerticalList>
    </div>
  )
}
