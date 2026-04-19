import { useEffect } from 'react'
import { WatchableObject } from '@zenith-tv/content'

interface VideoPlayerProps {
  watchable: WatchableObject
  onClose: () => void
}

export function VideoPlayer({ watchable, onClose }: VideoPlayerProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.keyCode === 27 || e.keyCode === 8 || e.keyCode === 10009) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <object type="application/avplayer" className="absolute inset-0 w-full h-full" />
      <div className="relative text-center text-white/60 text-sm">
        {watchable.Name}
      </div>
    </div>
  )
}
