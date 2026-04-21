import { WatchableObject } from '@zenith-tv/content'
import { Radio } from 'lucide-react'
import { cn } from '@zenith-tv/ui/lib'

interface ZapBannerProps {
  watchable: WatchableObject
}

export function ZapBanner({ watchable }: ZapBannerProps) {
  return (
    <div className="absolute inset-y-0 right-0 flex items-center pr-16">
      <div className={cn(
        'flex items-center gap-6 px-8 py-6 rounded-2xl',
        'bg-secondary/70 backdrop-blur-[32px] border border-border/20',
        'shadow-2xl shadow-black/60',
      )}>
        {watchable.Logo ? (
          <img
            src={watchable.Logo}
            alt={watchable.Name}
            className="w-16 h-16 rounded-xl object-cover shrink-0"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Radio className="w-7 h-7 text-primary" />
          </div>
        )}

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
            {watchable.category === 'LiveStream' ? 'Canlı Yayın' : watchable.Group || 'İçerik'}
          </p>
          <h2 className="font-headline text-4xl font-black text-white leading-none tracking-tight">
            {watchable.Name}
          </h2>
          {watchable.Year && (
            <p className="text-sm text-muted-foreground mt-2 font-medium">
              {watchable.Year}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
