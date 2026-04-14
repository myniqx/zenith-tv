import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@zenith-tv/ui/lib/cn'
import { FocusCard, FocusButton } from '@/components/Navigation'
import { CardContent } from '@zenith-tv/ui/card'
import { Badge } from '@zenith-tv/ui/badge'
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
    <div className="w-1/3 border-r border-border p-6 flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Profiller
      </h2>

      <div className="flex-1 overflow-y-auto space-y-2">
        {profiles.map((profile) => {
          const isSelected = selectedProfile === profile.username
          const isActive = currentUsername === profile.username

          return (
            <FocusCard
              key={profile.username}
              focusId={`profile-${profile.username}`}
              onEnter={() => onSelectProfile(profile.username)}
              onClick={() => onSelectProfile(profile.username)}
              className={cn(
                isActive && 'border-l-primary/40',
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
                      {profile.username}
                    </span>
                    {isActive && (
                      <Badge variant="secondary" className="text-xs shrink-0">Aktif</Badge>
                    )}
                  </div>
                  <FocusButton
                    focusId={`delete-profile-${profile.username}`}
                    onClick={(e) => { e.stopPropagation(); onDeleteProfile(profile.username) }}
                    variant="ghost"
                    size="icon"
                    focusStyle="highlight"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Profili sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </FocusButton>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 ml-3.5">
                  {profile.m3uRefs.length} kaynak
                </p>
              </CardContent>
            </FocusCard>
          )
        })}

        <FocusCard
          focusId="add-profile"
          onEnter={onAddProfile}
          onClick={onAddProfile}
          className="border-dashed border-2 bg-transparent hover:bg-muted/30"
        >
          <CardContent className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
            <Plus className="w-4 h-4" />
            <span className="text-sm">Yeni Profil</span>
          </CardContent>
        </FocusCard>
      </div>
    </div>
  )
}
