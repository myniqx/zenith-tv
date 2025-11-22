import { useContentStore } from '../stores/content';
import { Separator } from '@zenith-tv/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { ChevronRight, ChevronDown, LayoutGrid } from 'lucide-react';
import { GroupObject } from '@/m3u/group';
import { useState, useCallback } from 'react';
import { cn } from '@zenith-tv/ui/lib/cn';

interface CategoryBrowserProps {
  isCollapsed?: boolean;
}

interface TreeNodeProps {
  group: GroupObject;
  level: number;
  expandedNodes: Set<string>;
  toggleExpand: (nodeId: string) => void;
  isCollapsed?: boolean;
}

function TreeNode({ group, level, expandedNodes, toggleExpand, isCollapsed }: TreeNodeProps) {
  const { currentGroup, setGroup } = useContentStore();
  const nodeId = `${group.Name}-${level}`;
  const isExpanded = expandedNodes.has(nodeId);
  const isSelected = currentGroup === group;
  const hasChildren = group.Groups.length > 0;
  const Icon = group.GetListIcon;

  const handleClick = useCallback(() => {
    setGroup(group);
  }, [group, setGroup]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleExpand(nodeId);
  }, [nodeId, toggleExpand]);

  // In collapsed mode, only show root level items as icons
  if (isCollapsed) {
    if (level > 1) return null;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center justify-center p-2 rounded-md cursor-pointer transition-colors',
              'hover:bg-secondary/50',
              isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
            onClick={handleClick}
          >
            <Icon className="w-5 h-5" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{group.Name} ({group.TotalCount})</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors',
          'hover:bg-secondary/50',
          isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="p-0.5 hover:bg-secondary/50 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium truncate flex-1">{group.Name}</span>
        {group.TotalCount > 0 && (
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded-full',
            isSelected ? 'bg-primary-foreground/20' : 'bg-secondary text-muted-foreground'
          )}>
            {group.TotalCount}
          </span>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div>
          {group.Groups.map((childGroup, index) => (
            <TreeNode
              key={`${childGroup.Name}-${index}`}
              group={childGroup}
              level={level + 1}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryBrowser({ isCollapsed = false }: CategoryBrowserProps) {
  const {
    movieGroup,
    tvShowGroup,
    streamGroup,
    recentGroup,
    favoriteGroup,
    watchedGroup,
    currentGroup,
    setGroup,
  } = useContentStore();

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const rootGroups = [
    movieGroup,
    tvShowGroup,
    streamGroup,
    recentGroup,
    favoriteGroup,
    watchedGroup,
  ].filter(Boolean);

  const isAllSelected = currentGroup === null;

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        'h-full bg-secondary/30 flex flex-col transition-all duration-200',
        isCollapsed ? 'w-full' : 'w-full'
      )}>
        {/* Header - Hidden when collapsed */}
        {!isCollapsed && (
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Categories
            </h2>
          </div>
        )}

        <nav className={cn(
          'flex-1 overflow-y-auto',
          isCollapsed ? 'p-1' : 'p-2'
        )}>
          {/* All - Root node */}
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'flex items-center justify-center p-2 rounded-md cursor-pointer transition-colors',
                    'hover:bg-secondary/50',
                    isAllSelected && 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                  onClick={() => setGroup(null)}
                >
                  <LayoutGrid className="w-5 h-5" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>All</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div
              className={cn(
                'flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors',
                'hover:bg-secondary/50',
                isAllSelected && 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
              onClick={() => setGroup(null)}
            >
              <span className="w-5" />
              <LayoutGrid className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">All</span>
            </div>
          )}

          {/* Root level groups */}
          {rootGroups.map((group, index) => (
            <TreeNode
              key={`${group.Name}-${index}`}
              group={group}
              level={1}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>

        {/* Footer - Hidden when collapsed */}
        {!isCollapsed && (
          <>
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
          </>
        )}
      </aside>
    </TooltipProvider>
  );
}
