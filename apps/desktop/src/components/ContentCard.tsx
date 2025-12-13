import { memo } from 'react';
import { WatchableObject } from '@zenith-tv/content';
import { useContentStore } from '@/stores/content';
import { useUniversalPlayerStore } from '@/stores/universalPlayerStore';
import { Badge } from '@zenith-tv/ui/badge';
import { Button } from '@zenith-tv/ui/button';
import { Play, Star, Radio, Tv, Film, Check } from 'lucide-react';

interface ContentCardProps {
  item: WatchableObject;
  isSelected?: boolean;
}

export const ContentCard = memo(function ContentCard({ item, isSelected }: ContentCardProps) {
  const { toggleFavorite } = useContentStore();
  const { play } = useUniversalPlayerStore();

  const getCategoryBadge = () => {
    if (item.category === 'LiveStream') {
      return { text: 'LIVE', variant: 'destructive' as const, icon: Radio };
    }
    if (item.category === 'Series') {
      return {
        text: 'SERIES',
        variant: 'secondary' as const,
        icon: Tv,
      };
    }
    return { text: 'MOVIE', variant: 'default' as const, icon: Film };
  };

  const badge = getCategoryBadge();
  const CategoryIcon = badge.icon;

  const isFavorite = item.userData?.favorite?.value ?? false;
  const watchProgress = item.userData?.watchProgress;
  const progressPercent = (watchProgress?.progress ?? 0) * 100;
  const isWatched = watchProgress?.watched !== null && watchProgress?.watched !== undefined;

  const handleClick = () => {
    play(item);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(item);
  };

  return (
    <div
      onClick={handleClick}
      className="group cursor-pointer h-full flex flex-col"
      role="button"
      tabIndex={isSelected ? 0 : -1}
      aria-label={`${item.Name}. ${badge.text}. ${item.Group || 'No group'}`}
    >
      <div className={`relative aspect-2/3 bg-secondary rounded-lg overflow-hidden
                    hover:ring-2 hover:ring-primary transition-all
                    ${isSelected ? 'ring-4 ring-primary ring-offset-2 ring-offset-background' : ''}`}>
        {item.Logo ? (
          <img
            src={item.Logo}
            alt={item.Name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-secondary to-muted">
            <CategoryIcon className="w-16 h-16 text-muted-foreground/50" />
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100
                      transition-opacity flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
            <Play className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>

        {/* Category badge */}
        <Badge
          variant={badge.variant}
          className="absolute top-2 right-2"
        >
          {badge.text}
        </Badge>

        {/* Favorite button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleFavorite}
          className="absolute top-2 left-2 h-7 w-7 bg-black/50 hover:bg-black/70"
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star
            className={`w-4 h-4 ${isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`}
          />
        </Button>

        {/* Watched badge */}
        {isWatched && (
          <div className="absolute bottom-2 right-2 h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}

        {/* Watch progress bar */}
        {watchProgress && progressPercent > 0 && progressPercent < 95 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Year badge if available */}
        {item.Year && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 rounded text-xs text-white">
            {item.Year}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="mt-2 flex-1">
        <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
          {item.Name}
        </h3>
        {item.Group && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.Group}</p>
        )}
      </div>
    </div>
  );
});
