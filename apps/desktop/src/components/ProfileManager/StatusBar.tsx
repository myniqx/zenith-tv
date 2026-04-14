import { useContentStore } from '@/stores/content';
import { cn } from '@zenith-tv/ui/lib/cn';

export function StatusBar() {
  const statusMessage = useContentStore(s => s.statusMessage);

  return (
    <div className={cn('-mx-6 px-6 pb-3', statusMessage.status === 'idle' ? 'invisible' : 'visible')}>
      <span className={cn(
        'text-xs',
        statusMessage.status === 'error' && 'text-destructive',
        statusMessage.status === 'ready' && 'text-green-500',
        statusMessage.status === 'loading' && 'text-muted-foreground',
      )}>
        {statusMessage.message ?? '\u00A0'}
      </span>
      <div className="mt-1 h-[2px] w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full transition-all duration-300',
            statusMessage.status === 'loading' && 'bg-primary',
            statusMessage.status === 'ready' && 'bg-green-500',
            (statusMessage.status === 'error' || statusMessage.percent === null) && 'bg-transparent',
          )}
          style={{ width: statusMessage.percent !== null ? `${statusMessage.percent}%` : '0%' }}
        />
      </div>
    </div>
  );
}
