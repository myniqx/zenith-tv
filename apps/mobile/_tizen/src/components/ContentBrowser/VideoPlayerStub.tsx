import { WatchableObject } from '@zenith-tv/content'

interface VideoPlayerStubProps {
  watchable: WatchableObject
  onClose: () => void
}

export function VideoPlayerStub({ watchable }: VideoPlayerStubProps) {
  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center">
      <p className="text-2xl text-white/20 font-mono select-none">{watchable.Name}</p>
    </div>
  )
}
