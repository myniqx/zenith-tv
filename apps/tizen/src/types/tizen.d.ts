declare global {
  interface Window {
    webapis?: {
      avplay?: {
        open: (url: string) => void
        prepare: () => void
        play: () => void
        pause: () => void
        stop: () => void
        close: () => void
        seekTo: (time: number) => void
        setListener: (listener: {
          onStateChange?: (state: string) => void
          onCurrentPlayTime?: (currentTime: number) => void
          onError?: (errorCode: string) => void
          onBufferingStart?: () => void
          onBufferingEnd?: () => void
          onBufferingProgress?: (percentage: number) => void
        }) => void
        getDuration: () => number
        getCurrentTime: () => number
        setDisplayRect: (x: number, y: number, width: number, height: number) => void
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

export {}
