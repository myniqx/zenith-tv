import { useContentStore } from '../stores/content';
import { Button } from '@zenith-tv/ui/button';
import { Separator } from '@zenith-tv/ui/separator';
import {
  LayoutGrid,
  Film,
  Tv,
  Radio,
  Star,
  Clock,
  type LucideIcon,
} from 'lucide-react';

type CategoryType = 'all' | 'movies' | 'series' | 'live' | 'favorites' | 'recent';

interface Category {
  id: CategoryType;
  name: string;
  icon: LucideIcon;
}

const categories: Category[] = [
  { id: 'all', name: 'All', icon: LayoutGrid },
  { id: 'movies', name: 'Movies', icon: Film },
  { id: 'series', name: 'TV Shows', icon: Tv },
  { id: 'live', name: 'Live', icon: Radio },
  { id: 'favorites', name: 'Favorites', icon: Star },
  { id: 'recent', name: 'Recent', icon: Clock },
];

export function CategoryBrowser() {
  const { currentCategory, setCategory } = useContentStore();

  return (
    <aside className="w-64 bg-secondary/30 border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Categories
        </h2>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {categories.map((category) => {
          const Icon = category.icon;
          const isActive = currentCategory === category.id;

          return (
            <Button
              key={category.id}
              variant={isActive ? 'default' : 'ghost'}
              onClick={() => setCategory(category.id)}
              className="w-full justify-start gap-3 mb-1"
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{category.name}</span>
            </Button>
          );
        })}
      </nav>

      <Separator />

      <div className="p-4">
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium mb-2">Keyboard Shortcuts:</p>
          <div className="space-y-1 font-mono text-[10px]">
            <p><kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">Space</kbd> Play/Pause</p>
            <p><kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">F</kbd> Fullscreen</p>
            <p><kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">M</kbd> Mute</p>
            <p><kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">←/→</kbd> Skip ±10s</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
