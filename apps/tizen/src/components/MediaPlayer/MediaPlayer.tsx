import { useEffect } from 'react'
import { MultiLayer } from '@navix/react'
import { WatchableObject } from '../../lib/content'
import { useTizenPlayerStore } from '../../stores/tizenPlayer'
import { VideoPlayerAVPlay } from './VideoPlayerAVPlay'
import { VideoPlayerHTML5 } from './VideoPlayerHTML5'

const HAS_AVPLAY = !!window.webapis?.avplay
import { ControlPanel } from './ControlPanel'
import { TrackPanel } from './TrackPanel'
import { EpisodePanel } from './EpisodePanel'
import { MetaPanel } from './MetaPanel'
import { ZapBanner } from './ZapBanner'

interface MediaPlayerProps {
  watchable: WatchableObject
  groupItems?: WatchableObject[]
  onClose: () => void
  onSelectItem?: (item: WatchableObject) => void
}

export function MediaPlayer({ watchable, groupItems = [], onClose, onSelectItem }: MediaPlayerProps) {
  const play = useTizenPlayerStore((s) => s.play)

  useEffect(() => {
    play(watchable)
  }, [watchable.Url])

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <MultiLayer
        fKey="media-player"
        onExitRequest={onClose}
        onNext={() => false}
        onPrev={() => false}

        baseLayer={() => (
          HAS_AVPLAY ? <VideoPlayerAVPlay /> : <VideoPlayerHTML5 />
        )}

        zapBanner={() => (
          <ZapBanner watchable={watchable} />
        )}

        down={(props) => (
          <ControlPanel {...props} onStop={onClose} />
        )}

        left={(props) => (
          <TrackPanel {...props} />
        )}

        right={groupItems.length > 0 ? (props) => (
          <EpisodePanel
            {...props}
            items={groupItems}
            current={watchable}
            onSelect={(item) => onSelectItem?.(item)}
          />
        ) : undefined}

        up={(props) => (
          <MetaPanel {...props} watchable={watchable} />
        )}

        panelTimeout={400000}
      />
    </div>
  )
}
