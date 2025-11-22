import { memo, useState, useCallback, useMemo } from 'react';
import { GroupObject } from '@/m3u/group';
import { WatchableObject } from '@/m3u/watchable';
import { GroupCard } from './GroupCard';
import { ContentCard } from './ContentCard';
import { Button } from '@zenith-tv/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zenith-tv/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

interface ContentGroupProps {
  title: string;
  items: WatchableObject[] | GroupObject[];
  type: 'groups' | 'watchables';
}

export const ContentGroup = memo(function ContentGroup({ title, items, type }: ContentGroupProps) {
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [currentPage, setCurrentPage] = useState(0);

  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedItems = useMemo(() => {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    return items.slice(start, end);
  }, [items, currentPage, pageSize]);

  const handlePageSizeChange = useCallback((value: string) => {
    const newSize = parseInt(value) as PageSize;
    setPageSize(newSize);
    setCurrentPage(0);
  }, []);

  const goToFirstPage = useCallback(() => setCurrentPage(0), []);
  const goToPrevPage = useCallback(() => setCurrentPage(p => Math.max(0, p - 1)), []);
  const goToNextPage = useCallback(() => setCurrentPage(p => Math.min(totalPages - 1, p + 1)), [totalPages]);
  const goToLastPage = useCallback(() => setCurrentPage(totalPages - 1), [totalPages]);

  // Reset page when items change
  useMemo(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    } else if (totalPages === 0) {
      setCurrentPage(0);
    }
  }, [totalPages, currentPage]);

  if (items.length === 0) {
    return null;
  }

  const startItem = currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, totalItems);

  return (
    <section className="flex flex-col border-1 border-gray-700 rounded-md">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>

        <div className="flex items-center gap-3">
          {/* Item count info */}
          <span className="text-sm text-muted-foreground">
            {startItem}-{endItem} of {totalItems}
          </span>

          {/* Page size selector */}
          <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-[80px] h-8" aria-label="Items per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(size => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Pagination controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToFirstPage}
              disabled={currentPage === 0}
              aria-label="First page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToPrevPage}
              disabled={currentPage === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <span className="text-sm text-muted-foreground min-w-[60px] text-center">
              {currentPage + 1} / {totalPages || 1}
            </span>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToNextPage}
              disabled={currentPage >= totalPages - 1}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToLastPage}
              disabled={currentPage >= totalPages - 1}
              aria-label="Last page"
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {type === 'groups' ? (
            (paginatedItems as GroupObject[]).map((group, index) => (
              <div key={group.Name || index} >
                <GroupCard group={group} />
              </div>
            ))
          ) : (
            (paginatedItems as WatchableObject[]).map((item, index) => (
              <div key={item.Url || index} >
                <ContentCard item={item} />
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
});
