declare global {
  interface Window {
    webapis?: {
      avplay?: {
        // Lifecycle
        open: (url: string) => void
        prepare: () => void
        close: () => void

        // Playback control
        play: () => void
        pause: () => void
        stop: () => void
        seekTo: (
          time: number,
          successCallback?: () => void,
          errorCallback?: (error: Error) => void
        ) => void
        jumpForward: (
          time: number,
          successCallback?: () => void,
          errorCallback?: (error: Error) => void
        ) => void
        jumpBackward: (
          time: number,
          successCallback?: () => void,
          errorCallback?: (error: Error) => void
        ) => void
        setSpeed: (speed: number) => void

        // State & info
        getState: () => AVPlayState
        getDuration: () => number
        getCurrentTime: () => number

        // Track management
        getTotalTrackInfo: () => AVPlayTrackInfo[]
        setSelectTrack: (type: AVPlayStreamType, index: number) => void

        // Audio
        enableAudioStream: () => void
        disableAudioStream: () => void

        // Subtitle
        setSilentSubtitle: (hidden: boolean) => void
        setExternalSubtitlePath: (path: string) => void
        setSubtitlePosition: (position: number) => void

        // Display
        setDisplayRect: (x: number, y: number, width: number, height: number) => void

        // Buffering
        setTimeoutForBuffering: (seconds: number) => void
        setBufferingParam: (
          option: AVPlayBufferOption,
          unit: AVPlayBufferSizeUnit,
          amount: number
        ) => void

        // Event listener
        setListener: (listener: AVPlayPlaybackCallback) => void
      }
      systeminfo?: {
        getCapability: (key: string) => any
      }
      tvinfo?: {
        getVersion: () => string
      }
    }
    tizen?: {
      application?: {
        getCurrentApplication: () => any
        exit: () => void
      }
      filesystem?: {
        resolve: (path: string, onSuccess: (file: any) => void, onError: (error: any) => void) => void
      }
    }
  }
}

// AVPlay Types
export type AVPlayState = 'NONE' | 'IDLE' | 'READY' | 'PLAYING' | 'PAUSED'
export type AVPlayStreamType = 'AUDIO' | 'VIDEO' | 'TEXT'
export type AVPlayBufferOption = 'PLAYER_BUFFER_FOR_PLAY' | 'PLAYER_BUFFER_FOR_RESUME'
export type AVPlayBufferSizeUnit = 'PLAYER_BUFFER_SIZE_IN_SECOND'

export interface AVPlayTrackInfo {
  type: AVPlayStreamType
  index: number
  extra_info?: string // JSON string with language, codec, channels, etc.
}

export interface AVPlaySubtitleAttribute {
  attr_type: number
  start_pos: number
  stop_pos: number
}

export interface AVPlayPlaybackCallback {
  // Playback events
  onstreamcompleted?: () => void
  oncurrentplaytime?: (currentTime: number) => void

  // Buffering events
  onbufferingstart?: () => void
  onbufferingprogress?: (percent: number) => void
  onbufferingcomplete?: () => void

  // Error events
  onerror?: (errorType: string) => void
  onerrormsg?: (errorType: string, errorMsg: string) => void

  // Subtitle events
  onsubtitlechange?: (
    duration: string,
    subtitles: string,
    type: string,
    attributes: AVPlaySubtitleAttribute[]
  ) => void

  // Generic events
  onevent?: (eventType: string, data: string) => void

  // DRM events
  ondrmevent?: (drmType: string, drmData: any) => void
}

export {}
