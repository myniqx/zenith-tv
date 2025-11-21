import { memo, useState, useEffect, useRef } from 'react';
import type { WatchableItem } from '@zenith-tv/types';
import { SkeletonGrid } from './SkeletonCard';
import { useContentStore } from '../stores/content';
import { usePlayerStore } from '@zenith-tv/ui/stores/player';
import { Badge } from '@zenith-tv/ui/badge';
import { Button } from '@zenith-tv/ui/button';
import { Play, Star, Radio, Tv, Film, Inbox } from 'lucide-react';

// @ts-ignore - react-window has complex export structure
import * as ReactWindowModule from 'react-window';

// Handle different export patterns
const ReactWindow = (ReactWindowModule as any).default || ReactWindowModule;
const FixedSizeGrid = ReactWindow.FixedSizeGrid || (ReactWindowModule as any).FixedSizeGrid;

// Global selected index for keyboard navigation
let globalSelectedIndex = -1;

// Card dimensions
const CARD_HEIGHT = 320;
const CARD_GAP = 16;
const GRID_PADDING = 24;

export function ContentGrid() {
  const { getFilteredItems, toggleFavorite, isLoading } = useContentStore();
  const { play } = usePlayerStore();
  const items = getFilteredItems();
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, columnCount: 4 });
  const [selectedIndex, setSelectedIndex] = useState(globalSelectedIndex);

  useEffect(() => {
    globalSelectedIndex = selectedIndex;
  }, [selectedIndex]);

  const getColumnCount = (width: number): number => {
    if (width >= 1536) return 6;
    if (width >= 1280) return 5;
    if (width >= 1024) return 4;
    if (width >= 768) return 3;
    return 2;
  };

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;
        const columnCount = getColumnCount(width);
        setDimensions({ width, height, columnCount });
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const { columnCount } = dimensions;
      const totalItems = items.length;

      if (totalItems === 0) return;

      let newIndex = selectedIndex;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          newIndex = selectedIndex === -1 ? 0 : Math.min(selectedIndex + 1, totalItems - 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          newIndex = selectedIndex === -1 ? 0 : Math.max(selectedIndex - 1, 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          newIndex = selectedIndex === -1 ? 0 : Math.min(selectedIndex + columnCount, totalItems - 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          newIndex = selectedIndex === -1 ? 0 : Math.max(selectedIndex - columnCount, 0);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < totalItems) {
            play(items[selectedIndex]);
          }
          break;
        case 'Tab':
          e.preventDefault();
          if (selectedIndex === -1) {
            newIndex = 0;
          } else {
            newIndex = e.shiftKey
              ? Math.max(selectedIndex - 1, 0)
              : Math.min(selectedIndex + 1, totalItems - 1);
          }
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = totalItems - 1;
          break;
        default:
          return;
      }

      if (newIndex !== selectedIndex) {
        setSelectedIndex(newIndex);
        if (gridRef.current && newIndex >= 0) {
          const rowIndex = Math.floor(newIndex / columnCount);
          gridRef.current.scrollToItem({
            align: 'auto',
            rowIndex,
            columnIndex: newIndex % columnCount,
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedIndex, dimensions, play]);

  if (isLoading) {
    return <SkeletonGrid count={24} />;
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Inbox className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-2xl font-semibold text-muted-foreground mb-2">
            No content found
          </h3>
          <p className="text-muted-foreground/60">
            Try selecting a different category or add a new profile
          </p>
        </div>
      </div>
    );
  }

  const { width, height, columnCount } = dimensions;
  const rowCount = Math.ceil(items.length / columnCount);
  const columnWidth = (width - GRID_PADDING * 2) / columnCount;

  return (
    <div ref={containerRef} className="h-full w-full">
      {width > 0 && height > 0 && (
        <FixedSizeGrid
          ref={gridRef}
          columnCount={columnCount}
          columnWidth={columnWidth}
          height={height}
          rowCount={rowCount}
          rowHeight={CARD_HEIGHT + CARD_GAP}
          width={width}
          overscanRowCount={2}
          className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
        >
          {({ columnIndex, rowIndex, style }) => {
            const index = rowIndex * columnCount + columnIndex;
            if (index >= items.length) return null;

            const item = items[index];
            const isSelected = index === selectedIndex;

            return (
              <div
                style={{
                  ...style,
                  left: Number(style.left) + GRID_PADDING + CARD_GAP / 2,
                  top: Number(style.top) + GRID_PADDING,
                  width: columnWidth - CARD_GAP,
                  height: CARD_HEIGHT,
                }}
              >
                <ContentCard
                  item={item}
                  onClick={play}
                  onToggleFavorite={toggleFavorite}
                  isSelected={isSelected}
                />
              </div>
            );
          }}
        </FixedSizeGrid>
      )}
    </div>
  );
}

interface ContentCardProps {
  item: WatchableItem;
  onClick: (item: WatchableItem) => void;
  onToggleFavorite?: (url: string) => void;
  isSelected?: boolean;
}

const ContentCard = memo(function ContentCard({ item, onClick, onToggleFavorite, isSelected }: ContentCardProps) {
  const getCategoryBadge = () => {
    if (item.category.type === 'live_stream') {
      return { text: 'LIVE', variant: 'destructive' as const, icon: Radio };
    }
    if (item.category.type === 'series') {
      const ep = item.category.episode;
      return {
        text: `S${ep.season.toString().padStart(2, '0')}E${ep.episode.toString().padStart(2, '0')}`,
        variant: 'secondary' as const,
        icon: Tv,
      };
    }
    return { text: 'MOVIE', variant: 'default' as const, icon: Film };
  };

  const badge = getCategoryBadge();
  const CategoryIcon = badge.icon;

  return (
    <div
      onClick={() => onClick(item)}
      className="group cursor-pointer h-full flex flex-col"
      role="button"
      tabIndex={isSelected ? 0 : -1}
      aria-label={`${item.title}. ${badge.text}. ${item.group || 'No group'}`}
    >
      <div className={`relative aspect-[2/3] bg-secondary rounded-lg overflow-hidden
                    hover:ring-2 hover:ring-primary transition-all
                    ${isSelected ? 'ring-4 ring-primary ring-offset-2 ring-offset-background' : ''}`}>
        {item.logo ? (
          <img
            src={item.logo}
            alt={item.title}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
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
        {onToggleFavorite && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.url);
            }}
            className="absolute top-2 left-2 h-7 w-7 bg-black/50 hover:bg-black/70"
            title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              className={`w-4 h-4 ${item.isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`}
            />
          </Button>
        )}
      </div>

      {/* Title */}
      <div className="mt-2 flex-1">
        <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        {item.group && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.group}</p>
        )}
      </div>
    </div>
  );
});
