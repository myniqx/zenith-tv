import type { VlcTrack } from '@zenith-tv/content'
import type { AVPlayTrackInfo } from '../types/tizen'
import type { PlayerBackend, PlayerBackendCallbacks } from './playerBackend'

function mapTracks(tracks: AVPlayTrackInfo[]): { audio: VlcTrack[]; subtitle: VlcTrack[] } {
  const audio: VlcTrack[] = []
  const subtitle: VlcTrack[] = []

  tracks.forEach((track) => {
    let name = `Track ${track.index}`
    if (track.extra_info) {
      try {
        const info = JSON.parse(track.extra_info)
        if (info.language) {
          name = info.language.toUpperCase()
          if (info.channels) name += ` (${info.channels}ch)`
        }
      } catch {}
    }

    const vlcTrack: VlcTrack = { id: track.index, name }
    if (track.type === 'AUDIO') audio.push(vlcTrack)
    else if (track.type === 'TEXT') subtitle.push(vlcTrack)
  })

  return { audio, subtitle }
}

export function createAVPlayBackend(): PlayerBackend {
  const avplay = window.webapis!.avplay

  return {
    open: async (url, callbacks) => {
      try {
        const state = avplay.getState()
        if (state !== 'NONE' && state !== 'IDLE') avplay.stop()
        if (state !== 'NONE') avplay.close()
      } catch {}

      avplay.open(url)

      avplay.setListener({
        onstreamcompleted: () => {
          callbacks.onEnded()
        },

        oncurrentplaytime: (currentTimeMs: number) => {
          const duration = Math.floor(avplay.getDuration() / 1000)
          callbacks.onTimeUpdate(Math.floor(currentTimeMs / 1000), duration)
        },

        onbufferingstart: () => {
          callbacks.onBuffering(0)
          callbacks.onStateChange('buffering')
        },

        onbufferingprogress: (percent: number) => {
          callbacks.onBuffering(percent)
        },

        onbufferingcomplete: () => {
          callbacks.onBuffering(0)
          callbacks.onStateChange('playing')
        },

        onerror: (errorType: string) => {
          console.error('[AVPlay] Error:', errorType)
          callbacks.onError(`AVPlay error: ${errorType}`)
        },

        onerrormsg: (errorType: string, errorMsg: string) => {
          console.error('[AVPlay] Error:', errorType, errorMsg)
          callbacks.onError(`${errorType}: ${errorMsg}`)
        },

        onsubtitlechange: (_duration: number, subtitles: string) => {
          console.log('[AVPlay] Subtitle changed:', subtitles)
        },
      })

      avplay.prepare()

      const duration = Math.floor(avplay.getDuration() / 1000)
      const trackInfo = avplay.getTotalTrackInfo()
      const { audio, subtitle } = mapTracks(trackInfo)

      callbacks.onTracksReady(audio, subtitle)
      callbacks.onTimeUpdate(0, duration)

      avplay.play()
      callbacks.onStateChange('playing')
    },

    play: () => avplay.play(),
    pause: () => avplay.pause(),
    stop: () => avplay.stop(),
    seekTo: (seconds) => avplay.seekTo(seconds * 1000),
    setAudioTrack: (id) => avplay.setSelectTrack('AUDIO', id),
    setSubtitleTrack: (id) => {
      if (id === -1) {
        avplay.setSilentSubtitle(true)
      } else {
        avplay.setSelectTrack('TEXT', id)
        avplay.setSilentSubtitle(false)
      }
    },
    destroy: () => {
      try {
        const state = avplay.getState()
        if (state !== 'NONE' && state !== 'IDLE') avplay.stop()
        if (state !== 'NONE') avplay.close()
      } catch {}
    },
  }
}
