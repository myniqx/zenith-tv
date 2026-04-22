import { ListVideo, User } from 'lucide-react'
import { cn } from '@zenith-tv/ui/lib'
import { Button, HorizontalList, Expandable } from '@navix/react'
import { useProfilesStore } from '@/stores/profiles'
import { useContentStore } from '@/stores/content'
import { M3UStatsPlaceholder } from './M3UStatsPlaceholder'
import { ConfirmButton } from './ConfirmDialog'
import { M3UModal } from './M3UModal'
import type { Profile } from '@/stores/profiles'

interface ProfileCardProps {
  profile: Profile
  isActive: boolean
  onPendingSelect: () => void
  onDeleted: () => void
}

export function ProfileCard({ profile, isActive, onPendingSelect, onDeleted }: ProfileCardProps) {
  const { deleteProfile } = useProfilesStore()
  const { currentUUID } = useContentStore()
  const currentUsername = useProfilesStore(s => s.getCurrentUsername())

  const hasM3U = profile.m3uRefs.length > 0
  const activeUUID = hasM3U
    ? profile.m3uRefs.find(uuid => currentUUID === uuid && currentUsername === profile.username) ?? profile.m3uRefs[0]
    : null

  return (
    <div className="bg-secondary rounded-xl overflow-hidden transition-colors duration-200">

      {/* Profile Header Row */}
      <div className="flex items-start gap-6 px-6 pt-6 pb-4">

        {/* Left: Profile identity */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className={cn(
            'flex items-center justify-center w-12 h-12 rounded-full shrink-0',
            isActive ? 'bg-primary/20' : 'bg-muted',
          )}>
            <User size={20} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <p className="font-headline text-lg font-black tracking-tight text-foreground truncate">
                {profile.username}
              </p>
              {isActive && (
                <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
                  Aktif
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {profile.m3uRefs.length} M3U kaynağı
            </p>
          </div>
        </div>

        {/* Right: Stats */}
        {activeUUID && (
          <div className="shrink-0 flex items-center h-12">
            <M3UStatsPlaceholder uuid={activeUUID} />
          </div>
        )}
      </div>

      {/* Bottom action row */}
      <HorizontalList fKey={`profile-actions-${profile.username}`}>
        <div className="flex items-center justify-end px-6 pb-5 pt-2">

          {/* M3U Edit Modal trigger */}
          <Expandable fKey={`m3u-modal-${profile.username}`}>
            {({ isExpanded, directlyFocused, collapse }) => (
              <>
                <div className={cn(
                  'flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer',
                  directlyFocused
                    ? 'bg-accent text-foreground scale-100'
                    : 'bg-muted text-muted-foreground scale-95',
                )}>
                  <ListVideo className="w-3.5 h-3.5" />
                  M3U Düzenle
                </div>

                {isExpanded && (
                  <M3UModal
                    profile={profile}
                    onClose={collapse}
                    onPendingSelect={onPendingSelect}
                  />
                )}
              </>
            )}
          </Expandable>

          {/* Delete Profile */}
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

    </div>
  )
}
