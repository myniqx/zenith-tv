import { useEffect, useState } from 'react';
import { useProfilesStore } from '@/stores/profiles';
import { useContentStore, type M3UStats } from '@/stores/content';
import { Card, CardContent } from '@zenith-tv/ui/card';
import { Button } from '@zenith-tv/ui/button';
import { RefreshCw, X, Film, Tv, Radio } from 'lucide-react';
import { fileSystem } from '@/libs';
import { cn } from '@zenith-tv/ui/lib/cn';

const getM3UStatsPath = (uuid: string) => `m3u/${uuid}/stats.json`;

interface M3USourceCardProps {
  uuid: string;
  profileUsername: string;
  onDelete: () => void;
  onSelect: () => void;
}

export function M3USourceCard({ uuid, profileUsername, onDelete, onSelect }: M3USourceCardProps) {
  const getUrlFromUUID = useProfilesStore(s => s.getUrlFromUUID);
  const selectProfile = useProfilesStore(s => s.selectProfile);
  const getCurrentUsername = useProfilesStore(s => s.getCurrentUsername);

  const update = useContentStore(s => s.update);
  const isLoading = useContentStore(s => s.isLoading);
  const currentUUID = useContentStore(s => s.currentUUID);

  const currentUsername = getCurrentUsername();
  const isActive = currentUUID === uuid && currentUsername === profileUsername;
  const isSyncing = isLoading && isActive;

  const [stats, setStats] = useState<M3UStats | null>(null);

  useEffect(() => {
    fileSystem.readJSONOrDefault<M3UStats | null>(getM3UStatsPath(uuid), null)
      .then(setStats)
      .catch(() => setStats(null));
  }, [uuid]);

  const displayName = (() => {
    const url = getUrlFromUUID(uuid);
    if (!url) return uuid.slice(0, 8);
    if (url.startsWith('file://')) {
      return url.replace('file://', '').split(/[/\\]/).pop() || uuid.slice(0, 8);
    }
    try {
      const u = new URL(url);
      return u.pathname.split('/').pop() || u.hostname;
    } catch {
      return url.slice(0, 30) + (url.length > 30 ? '...' : '');
    }
  })();

  const handleClick = () => {
    if (isActive) return;
    selectProfile(profileUsername, uuid);
    onSelect();
  };

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isActive) {
      await selectProfile(profileUsername, uuid);
    }
    update();
  };

  return (
    <Card
      className={cn(
        'transition-colors',
        isActive
          ? 'border-primary bg-primary/10 cursor-default'
          : 'cursor-pointer hover:border-primary/40 hover:bg-muted/50',
      )}
      onClick={handleClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn('font-medium truncate', isActive && 'text-foreground')}>
              {displayName}
            </p>
            <div className="mt-1">
              {stats ? (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Film className="w-3 h-3" />
                    {stats.movieCount} movies
                  </span>
                  <span className="flex items-center gap-1">
                    <Tv className="w-3 h-3" />
                    {stats.tvShowCount} series
                  </span>
                  <span className="flex items-center gap-1">
                    <Radio className="w-3 h-3" />
                    {stats.liveStreamCount} live
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Not synced yet</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              onClick={handleSync}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Sync M3U"
              disabled={isSyncing}
            >
              <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} />
            </Button>
            <Button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Remove M3U"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
