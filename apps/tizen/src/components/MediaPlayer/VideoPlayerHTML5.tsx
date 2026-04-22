import { useEffect, useRef } from 'react'
import { createHTML5Backend } from '../../backends/html5Backend'
import { useTizenPlayerStore } from '../../stores/tizenPlayer'

export function VideoPlayerHTML5() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const setupBackend = useTizenPlayerStore((s) => s.setupBackend)

  useEffect(() => {
    if (!videoRef.current) return
    const backend = createHTML5Backend(videoRef.current)
    setupBackend(backend)
    return () => backend.destroy()
  }, [])

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 w-full h-full"
      playsInline
    />
  )
}
