import type { VlcTrack, VlcState } from '../lib/content'

export interface PlayerBackendCallbacks {
  onTimeUpdate: (time: number, duration: number) => void
  onStateChange: (state: VlcState) => void
  onTracksReady: (audio: VlcTrack[], subtitle: VlcTrack[]) => void
  onBuffering: (percent: number) => void
  onError: (message: string) => void
  onEnded: () => void
}

export interface PlayerBackend {
  open: (url: string, callbacks: PlayerBackendCallbacks) => Promise<void>
  play: () => void
  pause: () => void
  stop: () => void
  seekTo: (seconds: number) => void
  setAudioTrack: (id: number) => void
  setSubtitleTrack: (id: number) => void
  destroy: () => void
}
