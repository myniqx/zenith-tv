import { useEffect, useRef } from 'react'
import { useContentStore } from '@/stores/content'
import { useProfilesStore } from '@/stores/profiles'
import { ProfileCard } from './ProfileCard'
import { AddProfileForm } from './AddProfileForm'
import { StatusBar } from './StatusBar'
import { VerticalList, Expandable } from '@navix/react'
import { cn } from '@zenith-tv/ui/lib'
import { Plus } from 'lucide-react'
import { useMemo } from 'react'

interface ProfileManagerProps {
  onDone?: () => void
}

export function ProfileManager({ onDone }: ProfileManagerProps) {
  const { statusMessage } = useContentStore()
  const { profiles, getCurrentUsername } = useProfilesStore()
  const currentUsername = getCurrentUsername()
  const pendingDone = useRef(false)
  const isLocked = statusMessage.status === 'loading' && statusMessage.percent !== null

  useEffect(() => {
    if (pendingDone.current && statusMessage.status === 'ready') {
      pendingDone.current = false
      onDone?.()
    }
    if (pendingDone.current && statusMessage.status === 'error') {
      pendingDone.current = false
    }
  }, [statusMessage.status, onDone])

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0)),
    [profiles],
  )

  return (
    <div className={cn(
      'flex-1 min-h-0 bg-background text-foreground flex flex-col overflow-y-auto',
      isLocked && 'pointer-events-none select-none opacity-60',
    )}>
      <div className="max-w-5xl mx-auto w-full px-12 py-10">

        <h1 className="font-headline text-3xl font-black tracking-tight text-foreground mb-1">
          Profil Yönetimi
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Profillerinizi ve M3U kaynaklarınızı yönetin
        </p>

        <VerticalList fKey="profile-list">
          <div className="space-y-4">

            {sortedProfiles.map((profile) => (
              <ProfileCard
                key={profile.username}
                profile={profile}
                isActive={currentUsername === profile.username}
                onPendingSelect={() => { pendingDone.current = true }}
                onDeleted={() => {}}
              />
            ))}

            {/* New Profile */}
            <Expandable fKey="add-profile">
              {({ isExpanded, directlyFocused, collapse }) => (
                <>
                  <div className={cn(
                    'flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-dashed transition-all duration-200 cursor-pointer',
                    directlyFocused
                      ? 'border-primary/60 text-primary bg-primary/5'
                      : 'border-border/20 text-muted-foreground',
                  )}>
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-semibold">Yeni Profil</span>
                  </div>

                  {isExpanded && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                      <AddProfileForm
                        onSuccess={() => { collapse(); pendingDone.current = true }}
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

      <StatusBar />
    </div>
  )
}
