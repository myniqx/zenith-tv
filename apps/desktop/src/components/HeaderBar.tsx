import { useContentStore } from '../stores/content';
import { useProfilesStore } from '../stores/profiles';
import { ProfileManager } from './ProfileManager';
import { P2PControl } from './Header/P2PControl';
import { Settings } from './Settings';
import { GroupObject } from '@/m3u/group';
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

export function HeaderBar() {
  const { currentGroup, setGroup } = useContentStore();
  const { getCurrentUsername } = useProfilesStore();

  const currentUsername = getCurrentUsername();
  const breadcrumbs = getBreadcrumbs(currentGroup);

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card" role="banner">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          Zenith TV
        </h1>
        {currentUsername && (
          <span className="text-sm text-muted-foreground" aria-label={`Current profile: ${currentUsername}`}>
            • {currentUsername}
          </span>
        )}

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 ml-4" aria-label="Breadcrumb">
          <button
            onClick={() => setGroup(null)}
            className={`text-sm px-2 py-1 rounded transition-colors ${currentGroup === null
              ? 'text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
          >
            All
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

      <div className="flex items-center gap-2">
        <P2PControl />
        <Settings />
        <ProfileManager />
      </div>
    </header>
  );
}
