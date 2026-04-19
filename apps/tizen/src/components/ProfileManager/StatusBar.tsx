import { useContentStore } from '@/stores/content'
import { cn } from '@zenith-tv/ui/lib'

export function StatusBar() {
  const { statusMessage } = useContentStore()
  const isIdle = statusMessage.status === 'idle'

  return (
    <div className={cn('px-8 py-3 transition-opacity duration-300', isIdle ? 'invisible' : 'visible')}>
      <span className={cn(
        'text-xs font-medium',
        statusMessage.status === 'error' ? 'text-destructive' :
        statusMessage.status === 'ready' ? 'text-success' :
        'text-muted-foreground',
      )}>
        {statusMessage.message ?? '\u00A0'}
      </span>
      <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-border/20">
        <div
          className={cn(
            'h-full transition-all duration-300',
            statusMessage.status === 'loading' ? 'bg-primary' :
            statusMessage.status === 'ready' ? 'bg-success' :
            'bg-transparent',
          )}
          style={{ width: statusMessage.percent !== null ? `${statusMessage.percent}%` : '0%' }}
        />
      </div>
    </div>
  )
}
