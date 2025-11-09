import { memo, useState, useEffect, useRef } from 'react';
import type { WatchableItem } from '@zenith-tv/types';
import { SkeletonGrid } from './SkeletonCard';

// @ts-ignore - react-window has complex export structure
import * as ReactWindowModule from 'react-window';

// Handle different export patterns
const ReactWindow = (ReactWindowModule as any).default || ReactWindowModule;
const FixedSizeGrid = ReactWindow.FixedSizeGrid || (ReactWindowModule as any).FixedSizeGrid;

interface ContentGridProps {
  items: WatchableItem[];
  onItemClick: (item: WatchableItem) => void;
  onToggleFavorite?: (url: string) => void;
  isLoading?: boolean;
}

// Global selected index for keyboard navigation
let globalSelectedIndex = -1;

// Card dimensions
const CARD_HEIGHT = 320; // aspect-[2/3] (200px) + title space (120px)
const CARD_GAP = 16; // gap-4 in pixels
const GRID_PADDING = 24; // p-6 in pixels

export function ContentGrid({ items, onItemClick, onToggleFavorite, isLoading }: ContentGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, columnCount: 4 });
  const [selectedIndex, setSelectedIndex] = useState(globalSelectedIndex);

  // Update global selected index when local changes
  useEffect(() => {
    globalSelectedIndex = selectedIndex;
  }, [selectedIndex]);

  // Calculate responsive column count based on width
  const getColumnCount = (width: number): number => {
    if (width >= 1536) return 6; // 2xl
    if (width >= 1280) return 5; // xl
    if (width >= 1024) return 4; // lg
    if (width >= 768) return 3;  // md
    return 2; // default
  };

  // Update dimensions on mount and window resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;
        const columnCount = getColumnCount(width);

        setDimensions({ width, height, columnCount });
      }
    };

    // Initial measurement
    updateDimensions();

    // Listen for resize
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is on input
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
          if (selectedIndex === -1) {
            newIndex = 0;
          } else {
            newIndex = Math.min(selectedIndex + 1, totalItems - 1);
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (selectedIndex === -1) {
            newIndex = 0;
          } else {
            newIndex = Math.max(selectedIndex - 1, 0);
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (selectedIndex === -1) {
            newIndex = 0;
          } else {
            newIndex = Math.min(selectedIndex + columnCount, totalItems - 1);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (selectedIndex === -1) {
            newIndex = 0;
          } else {
            newIndex = Math.max(selectedIndex - columnCount, 0);
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < totalItems) {
            onItemClick(items[selectedIndex]);
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

        // Scroll to selected item
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
  }, [items, selectedIndex, dimensions, onItemClick]);

  if (isLoading) {
    return <SkeletonGrid count={24} />;
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-2xl font-semibold text-gray-300 mb-2">
            No content found
          </h3>
          <p className="text-gray-500">
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
                  onClick={onItemClick}
                  onToggleFavorite={onToggleFavorite}
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
      return { text: 'LIVE', color: 'bg-red-500' };
    }
    if (item.category.type === 'series') {
      const ep = item.category.episode;
      return {
        text: `S${ep.season.toString().padStart(2, '0')}E${ep.episode.toString().padStart(2, '0')}`,
        color: 'bg-purple-500',
      };
    }
    return { text: 'MOVIE', color: 'bg-blue-500' };
  };

  const badge = getCategoryBadge();

  return (
    <div
      onClick={() => onClick(item)}
      className="group cursor-pointer h-full flex flex-col"
      role="button"
      tabIndex={isSelected ? 0 : -1}
      aria-label={`${item.title}. ${badge.text}. ${item.group || 'No group'}`}
    >
      <div className={`relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden
                    hover:ring-2 hover:ring-blue-500 transition-all
                    ${isSelected ? 'ring-4 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''}`}>
        {/* Thumbnail placeholder */}
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
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
            <span className="text-6xl opacity-50">
              {item.category.type === 'live_stream' ? '📡' :
               item.category.type === 'series' ? '📺' : '🎬'}
            </span>
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100
                      transition-opacity flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Category badge */}
        <div className={`absolute top-2 right-2 ${badge.color} px-2 py-1 rounded text-xs font-bold`}>
          {badge.text}
        </div>

        {/* Favorite button */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.url);
            }}
            className="absolute top-2 left-2 p-1 rounded-full bg-black/50 hover:bg-black/70
                     transition-colors z-10"
            title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <svg
              className={`w-5 h-5 ${item.isFavorite ? 'text-yellow-400' : 'text-gray-400'}`}
              fill={item.isFavorite ? 'currentColor' : 'none'}
              stroke={item.isFavorite ? 'none' : 'currentColor'}
              strokeWidth={item.isFavorite ? 0 : 2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          </button>
        )}
      </div>

      {/* Title */}
      <div className="mt-2 flex-1">
        <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-blue-400 transition-colors">
          {item.title}
        </h3>
        {item.group && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{item.group}</p>
        )}
      </div>
    </div>
  );
});
