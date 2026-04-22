import { useEffect } from 'react'
import { createAVPlayBackend } from '../../backends/avplayBackend'
import { useTizenPlayerStore } from '../../stores/tizenPlayer'

export function VideoPlayerAVPlay() {
  const setupBackend = useTizenPlayerStore((s) => s.setupBackend)

  useEffect(() => {
    if (!window.webapis?.avplay) return
    const backend = createAVPlayBackend()
    setupBackend(backend)
    return () => backend.destroy()
  }, [])

  return (
    <object
      type="application/avplayer"
      className="absolute inset-0 w-full h-full"
    />
  )
}
