import { MultiLayer } from '@navix/react'
import { WatchableObject } from '@zenith-tv/content'
import { VideoPlayerStub } from '../ContentBrowser/VideoPlayerStub'
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
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <MultiLayer
        fKey="media-player"
        onExitRequest={onClose}
        onNext={() => false}
        onPrev={() => false}

        baseLayer={() => (
          <VideoPlayerStub watchable={watchable} onClose={onClose} />
        )}

        zapBanner={() => (
          <ZapBanner watchable={watchable} />
        )}

        down={(props) => (
          <ControlPanel
            {...props}
            paused={false}
            position={0}
            duration={0}
            onPlayPause={() => {}}
            onSeek={() => {}}
            onStop={onClose}
          />
        )}

        left={(props) => (
          <TrackPanel
            {...props}
            audioTracks={[]}
            subtitleTracks={[]}
            currentAudio={-1}
            currentSubtitle={-1}
            onSelectAudio={() => {}}
            onSelectSubtitle={() => {}}
          />
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
          <MetaPanel
            {...props}
            watchable={watchable}
          />
        )}

        panelTimeout={4000}
      />
    </div>
  )
}
