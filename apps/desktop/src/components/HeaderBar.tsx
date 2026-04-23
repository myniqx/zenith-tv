import { useContentStore } from '../stores/content';
import { useProfilesStore } from '../stores/profiles';
import { ProfileManager } from './ProfileManager';
import { P2PControl } from './P2P/P2PControl';
import { Settings } from './Settings';
import { GroupObject } from '@zenith-tv/content';
import { ChevronRight } from 'lucide-react';

function getBreadcrumbs(group: GroupObject | null): GroupObject[] {
  const crumbs: GroupObject[] = [];
  let current: GroupObject | null | undefined = group;
  while (current) {
    crumbs.unshift(current);
    current = current.UpperLevel ?? null;
  }
  return crumbs;
}

interface HeaderBarProps {
  profileManagerInitialOpen?: boolean;
}

export function HeaderBar({ profileManagerInitialOpen = false }: HeaderBarProps) {
  const { currentGroup, setGroup } = useContentStore();
  const { getCurrentUsername } = useProfilesStore();

  const currentUsername = getCurrentUsername();
  const breadcrumbs = getBreadcrumbs(currentGroup);

  return (
    <header className="glass-header flex items-center justify-between px-8 py-3 shadow-2xl shadow-black/50 shrink-0" role="banner">
      <div className="flex items-center gap-8">
        <h1 className="font-headline text-2xl font-black italic tracking-tighter text-white">
          Zenith TV
        </h1>

        <div className="flex items-center gap-1">
          {currentUsername && (
            <span className="text-sm text-muted-foreground" aria-label={`Current profile: ${currentUsername}`}>
              •
            </span>
          )}

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1" aria-label="Breadcrumb">
            <button
              onClick={() => setGroup(null)}
              className={`text-sm px-2 py-1 rounded transition-colors ${currentGroup === null
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
            >
              {currentUsername || 'All'}
            </button>

            {breadcrumbs.map((crumb, index) => (
              <div key={`${crumb.Name}-${index}`} className="flex items-center gap-1">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <button
                  onClick={() => setGroup(crumb)}
                  className={`text-sm px-2 py-1 rounded transition-colors ${index === breadcrumbs.length - 1
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                >
                  {crumb.Name}
                </button>
              </div>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex items-center rounded-full bg-secondary/60 border border-border/20 overflow-hidden h-9">
        <P2PControl />
        <div className="w-px h-full bg-border/40" />
        <Settings />
        <div className="w-px h-full bg-border/40" />
        <ProfileManager initialOpen={profileManagerInitialOpen} />
      </div>
    </header>
  );
}
