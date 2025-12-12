import { memo } from 'react';
import { GroupObject } from '@zenith-tv/content';
import { useContentStore } from '@/stores/content';
import { Folder } from 'lucide-react';

interface GroupCardProps {
  group: GroupObject;
}

export const GroupCard = memo(function GroupCard({ group }: GroupCardProps) {
  const { setGroup } = useContentStore();
  const coverImages = group.getImageList(9);
  const Icon = group.GetListIcon;

  const handleClick = () => {
    setGroup(group);
  };

  return (
    <div
      onClick={handleClick}
      className="group cursor-pointer h-full flex flex-col"
      role="button"
      tabIndex={0}
      aria-label={`${group.Name}. ${group.TotalCount} items`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="relative aspect-[2/3] bg-secondary rounded-lg overflow-hidden
                    hover:ring-2 hover:ring-primary transition-all">
        {/* Cover Images Grid */}
        {coverImages.length > 0 ? (
          <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-0.5">
            {coverImages.slice(0, 9).map((cover, index) => (
              <div key={index} className="relative overflow-hidden bg-muted">
                {cover.Logo ? (
                  <img
                    src={cover.Logo}
                    alt={cover.Name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
                    <Folder className="w-4 h-4 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            ))}
            {/* Fill empty slots if less than 9 images */}
            {Array.from({ length: Math.max(0, 9 - coverImages.length) }).map((_, index) => (
              <div key={`empty-${index}`} className="bg-muted flex items-center justify-center">
                <Folder className="w-4 h-4 text-muted-foreground/30" />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
            <Icon className="w-16 h-16 text-muted-foreground/50" />
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100
                      transition-opacity flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
            <Folder className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>

        {/* Item count badge */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white font-medium">
          {group.TotalCount} items
        </div>
      </div>

      {/* Title */}
      <div className="mt-2 flex-1">
        <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors flex items-center gap-2">
          <Icon className="w-4 h-4 flex-shrink-0" />
          {group.Name}
        </h3>
        {group.Groups.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {group.Groups.length} subgroups
          </p>
        )}
      </div>
    </div>
  );
});
