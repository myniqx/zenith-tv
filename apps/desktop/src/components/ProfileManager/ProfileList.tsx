import { useMemo } from 'react';
import { useProfilesStore } from '@/stores/profiles';
import { useContentStore } from '@/stores/content';
import { Button } from '@zenith-tv/ui/button';
import { Badge } from '@zenith-tv/ui/badge';
import { Plus, User } from 'lucide-react';
import { cn } from '@zenith-tv/ui/lib/cn';

interface ProfileListProps {
  selectedProfileUsername: string | null;
  onSelectProfile: (username: string) => void;
  onAddProfile: () => void;
}

export function ProfileList({ selectedProfileUsername, onSelectProfile, onAddProfile }: ProfileListProps) {
  const profiles = useProfilesStore(s => s.profiles);
  const getCurrentUsername = useProfilesStore(s => s.getCurrentUsername);
  const currentUsername = getCurrentUsername();

  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));
  }, [profiles]);

  return (
    <div className="w-64 flex flex-col border-r pr-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Profiles</h3>
        <Button
          onClick={onAddProfile}
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Add profile"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5">
        {sortedProfiles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No profiles</p>
          </div>
        ) : (
          sortedProfiles.map((profile) => {
            const isSelected = selectedProfileUsername === profile.username;
            return (
              <button
                key={profile.username}
                onClick={() => onSelectProfile(profile.username)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-md transition-colors cursor-pointer',
                  'border-l-2',
                  isSelected
                    ? 'bg-primary/15 border-primary text-foreground'
                    : 'border-transparent hover:bg-muted hover:border-muted-foreground/30 text-muted-foreground hover:text-foreground',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn('font-medium truncate flex-1', isSelected && 'text-foreground')}>
                    {profile.username}
                  </span>
                  {currentUsername === profile.username && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {profile.m3uRefs.length} source{profile.m3uRefs.length !== 1 ? 's' : ''}
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
