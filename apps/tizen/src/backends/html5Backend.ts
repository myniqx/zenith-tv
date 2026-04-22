import type { PlayerBackend, PlayerBackendCallbacks } from './playerBackend'

export function createHTML5Backend(videoEl: HTMLVideoElement): PlayerBackend {
  let callbacks: PlayerBackendCallbacks | null = null

  const onTimeUpdate = () => {
    callbacks?.onTimeUpdate(videoEl.currentTime, videoEl.duration || 0)
  }
  const onPlay = () => {
    console.log('[HTML5] Playing')
    callbacks?.onStateChange('playing')
  }
  const onPause = () => {
    console.log('[HTML5] Paused at:', videoEl.currentTime)
    callbacks?.onStateChange('paused')
  }
  const onEnded = () => {
    console.log('[HTML5] Ended')
    callbacks?.onEnded()
  }
  const onWaiting = () => {
    console.warn('[HTML5] Waiting / buffering')
    callbacks?.onBuffering(0)
    callbacks?.onStateChange('buffering')
  }
  const onCanPlay = () => {
    console.log('[HTML5] Can play')
    callbacks?.onBuffering(100)
  }
  const onError = () => {
    const msg = videoEl.error?.message ?? 'Unknown error'
    console.error('[HTML5] Video error:', msg)
    callbacks?.onError(msg)
  }
  const onStalled = () => {
    console.warn('[HTML5] Stalled')
  }

  videoEl.addEventListener('timeupdate', onTimeUpdate)
  videoEl.addEventListener('play', onPlay)
  videoEl.addEventListener('pause', onPause)
  videoEl.addEventListener('ended', onEnded)
  videoEl.addEventListener('waiting', onWaiting)
  videoEl.addEventListener('canplay', onCanPlay)
  videoEl.addEventListener('error', onError)
  videoEl.addEventListener('stalled', onStalled)

  return {
    open: async (url, cbs) => {
      console.log('[HTML5] Loading URL:', url)
      callbacks = cbs
      videoEl.src = url
      videoEl.load()
      videoEl.play().catch((err) => console.error('[HTML5] Autoplay failed:', err))
    },

    play: () => {
      videoEl.play().catch((err) => console.error('[HTML5] play() failed:', err))
    },

    pause: () => videoEl.pause(),

    stop: () => {
      videoEl.pause()
      videoEl.currentTime = 0
      console.log('[HTML5] Stopped')
    },

    seekTo: (seconds) => {
      console.log('[HTML5] Seeking to:', seconds)
      videoEl.currentTime = seconds
    },

    setAudioTrack: (id) => {
      console.warn('[HTML5] Audio track selection not supported, id:', id)
    },

    setSubtitleTrack: (id) => {
      console.warn('[HTML5] Subtitle track selection not supported, id:', id)
    },

    destroy: () => {
      videoEl.removeEventListener('timeupdate', onTimeUpdate)
      videoEl.removeEventListener('play', onPlay)
      videoEl.removeEventListener('pause', onPause)
      videoEl.removeEventListener('ended', onEnded)
      videoEl.removeEventListener('waiting', onWaiting)
      videoEl.removeEventListener('canplay', onCanPlay)
      videoEl.removeEventListener('error', onError)
      videoEl.removeEventListener('stalled', onStalled)
      videoEl.pause()
      videoEl.src = ''
      callbacks = null
      console.log('[HTML5] Destroyed')
    },
  }
}
