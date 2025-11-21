export function SkeletonCard() {
  return (
    <div className="group cursor-pointer animate-pulse">
      <div className="relative aspect-[2/3] bg-secondary rounded-lg overflow-hidden">
        {/* Placeholder image */}
        <div className="w-full h-full bg-gradient-to-br from-muted to-secondary" />

        {/* Badge placeholder */}
        <div className="absolute top-2 right-2 bg-muted px-2 py-1 rounded w-16 h-5" />

        {/* Favorite button placeholder */}
        <div className="absolute top-2 left-2 p-1 rounded-full bg-muted w-7 h-7" />
      </div>

      {/* Title placeholder */}
      <div className="mt-2 space-y-2">
        <div className="h-4 bg-secondary rounded w-3/4" />
        <div className="h-3 bg-secondary rounded w-1/2" />
      </div>
    </div>
  );
}

interface SkeletonGridProps {
  count?: number;
}

export function SkeletonGrid({ count = 12 }: SkeletonGridProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 p-6">
        {Array.from({ length: count }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </div>
  );
}
