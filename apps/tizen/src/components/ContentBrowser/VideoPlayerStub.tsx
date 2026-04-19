import { useEffect } from 'react'
import { WatchableObject } from '@zenith-tv/content'
import { X } from 'lucide-react'

interface VideoPlayerStubProps {
  watchable: WatchableObject
  onClose: () => void
}

export function VideoPlayerStub({ watchable, onClose }: VideoPlayerStubProps) {
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
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
      <p className="text-3xl text-gray-300 mb-8">{watchable.Name}</p>
      <button onClick={onClose} className="flex items-center gap-2 px-6 py-3 bg-red-700 text-white rounded-lg">
        <X className="w-5 h-5" />
        Kapat (ESC)
      </button>
    </div>
  )
}
