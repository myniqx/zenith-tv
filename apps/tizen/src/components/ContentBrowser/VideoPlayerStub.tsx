import { WatchableObject } from '@zenith-tv/content'
import { FocusButton } from '@/components/Navigation'
import { FocusScope } from '@/contexts/FocusScope'
import { X } from 'lucide-react'

interface VideoPlayerStubProps {
  watchable: WatchableObject
  onClose: () => void
}

export function VideoPlayerStub({ watchable, onClose }: VideoPlayerStubProps) {
  return (
    <FocusScope id="video-player" onBack={onClose}>
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
        <div className="text-center max-w-4xl px-8">
          <h1 className="text-6xl font-bold mb-6 text-white">Video Player</h1>
          <p className="text-3xl text-gray-300 mb-4">{watchable.Name}</p>

          <div className="space-y-2 mb-8">
            <p className="text-gray-400">
              <span className="font-semibold">Category:</span> {watchable.category}
            </p>
            {watchable.Year && (
              <p className="text-gray-400">
                <span className="font-semibold">Year:</span> {watchable.Year}
              </p>
            )}
            {watchable.Group && (
              <p className="text-gray-400">
                <span className="font-semibold">Group:</span> {watchable.Group}
              </p>
            )}
            <p className="text-gray-500 text-sm break-all mt-4">
              <span className="font-semibold">URL:</span> {watchable.Url}
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-8">
            <p className="text-gray-400 text-lg">
              This is a stub video player for development.
            </p>
            <p className="text-gray-500 mt-2">
              The actual video player will be implemented later.
            </p>
          </div>

          <FocusButton
            focusId="close-player"
            onClick={onClose}
            variant="destructive"
            size="lg"
            className="px-8 py-4"
          >
            <X className="w-5 h-5 mr-2" />
            Close Player (ESC)
          </FocusButton>
        </div>
      </div>
    </FocusScope>
  )
}
