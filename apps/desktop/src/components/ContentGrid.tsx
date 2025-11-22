import { useContentStore } from '../stores/content';
import { SkeletonGrid } from './SkeletonCard';
import { ContentGroup } from './ContentGroup';
import { Inbox } from 'lucide-react';

export function ContentGrid() {
  const { groupedContent, isLoading, currentGroup } = useContentStore();

  if (isLoading) {
    return <SkeletonGrid count={24} />;
  }

  if (!currentGroup) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Inbox className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-2xl font-semibold text-muted-foreground mb-2">
            Select a category
          </h3>
          <p className="text-muted-foreground/60">
            Choose a category from the sidebar to browse content
          </p>
        </div>
      </div>
    );
  }

  if (groupedContent.length === 0 || groupedContent.every(g => g.items.length === 0)) {
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

  return (
    <div className="h-full overflow-y-auto space-y-4">
      {groupedContent.map((group, index) => (
        <ContentGroup
          key={`${group.title}-${index}`}
          title={group.title}
          items={group.items}
          type={group.type}
        />
      ))}
    </div>
  );
}
