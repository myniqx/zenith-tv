import { useEffect, useRef, useState } from 'react'
import { WatchableObject } from '@zenith-tv/content'
import { FocusButton } from '@/components/Navigation'
import { FocusScope } from '@/contexts/FocusScope'
import { useTizenPlayerStore } from '@/stores/tizenPlayer'
import { useSettingsStore } from '@/stores/settings'
import { useContentStore } from '@/stores/content'

interface VideoPlayerProps {
  watchable: WatchableObject
  onClose: () => void
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function VideoPlayer({ watchable, onClose }: VideoPlayerProps) {
  const player = useTizenPlayerStore()
  const { autoPlayNext } = useSettingsStore()
  const { getNextEpisode, getPreviousEpisode } = useContentStore()

  const [showControls, setShowControls] = useState(true)
  const [showTracks, setShowTracks] = useState(false)
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isPlaying = player.playerState === 'playing'
  const isBuffering = player.playerState === 'buffering'
  const progress = player.duration > 0 ? (player.time / player.duration) * 100 : 0

  const nextEpisode = watchable.category === 'Series' ? getNextEpisode(watchable) : undefined
  const prevEpisode = watchable.category === 'Series' ? getPreviousEpisode(watchable) : undefined

  // Start playback on mount
  useEffect(() => {
    player.init().then(() => {
      player.play(watchable)
    })
  }, [watchable.Url])

  // Auto-hide controls after 4 seconds of inactivity
  const resetHideTimer = () => {
    setShowControls(true)
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current)
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 4000)
  }

  useEffect(() => {
    resetHideTimer()
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current)
    }
  }, [isPlaying])

  // Show controls on any key press
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      resetHideTimer()

      // Shortcuts when controls are hidden
      if (!showControls && e.keyCode !== 27) return

      switch (e.keyCode) {
        case 32: // Space
        case 13: // Enter
          e.preventDefault()
          togglePlayPause()
          break
        case 37: // Left arrow — seek back 10s
          e.preventDefault()
          seekRelative(-10)
          break
        case 39: // Right arrow — seek forward 10s
          e.preventDefault()
          seekRelative(10)
          break
        case 27: // Escape / Back
          e.preventDefault()
          handleClose()
          break
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [showControls, isPlaying, player.time, player.duration])

  // Auto-play next episode when stream completes
  useEffect(() => {
    if (player.playerState === 'ended' && nextEpisode && autoPlayNext) {
      player.play(nextEpisode)
    }
  }, [player.playerState])

  const togglePlayPause = () => {
    if (isPlaying) {
      player.playback({ action: 'pause' })
    } else {
      player.playback({ action: 'play' })
    }
  }

  const seekRelative = (deltaSec: number) => {
    const newTime = Math.max(0, Math.min(player.time + deltaSec, player.duration))
    player.playback({ time: newTime })
  }

  const handleClose = () => {
    player.playback({ action: 'stop' })
    onClose()
  }

  return (
    <FocusScope id="video-player" onBack={handleClose}>
      <div
        className="fixed inset-0 bg-black z-50"
        onClick={resetHideTimer}
      >
        {/* AVPlay element — Tizen renders video here via native layer */}
        <object
          type="application/avplayer"
          className="absolute inset-0 w-full h-full"
        />

        {/* Buffering indicator */}
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-2xl">
              Yükleniyor... {player.buffering > 0 ? `${player.buffering}%` : ''}
            </div>
          </div>
        )}

        {/* Error state */}
        {player.playerState === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-400 text-2xl mb-4">Oynatma hatası</p>
              <p className="text-gray-400 text-lg">{player.error}</p>
            </div>
          </div>
        )}

        {/* Controls overlay */}
        {showControls && (
          <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-black/40">

            {/* Top bar */}
            <div className="flex items-center justify-between px-8 pt-6">
              <div>
                <h2 className="text-2xl font-bold text-white">{watchable.Name}</h2>
                {watchable.Group && (
                  <p className="text-gray-400 text-sm mt-1">{watchable.Group}</p>
                )}
              </div>
              <FocusButton
                focusId="player-close"
                onClick={handleClose}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
              >
                ✕ Kapat
              </FocusButton>
            </div>

            {/* Bottom controls */}
            <div className="px-8 pb-8">
              {/* Seek bar */}
              {player.duration > 0 && (
                <div className="mb-4">
                  <div className="w-full h-1.5 bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-gray-400 text-sm mt-1">
                    <span>{formatTime(player.time)}</span>
                    <span>{formatTime(player.duration)}</span>
                  </div>
                </div>
              )}

              {/* Playback buttons */}
              <div className="flex items-center gap-4">
                {prevEpisode && (
                  <FocusButton
                    focusId="player-prev-ep"
                    onClick={() => player.play(prevEpisode)}
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                  >
                    ⏮ Önceki
                  </FocusButton>
                )}

                <FocusButton
                  focusId="player-seek-back"
                  onClick={() => seekRelative(-30)}
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                >
                  ⏪ 30s
                </FocusButton>

                <FocusButton
                  focusId="player-play-pause"
                  onClick={togglePlayPause}
                  variant="default"
                  size="lg"
                  className="bg-red-600 hover:bg-red-700 px-8"
                >
                  {isPlaying ? '⏸ Duraklat' : '▶ Oynat'}
                </FocusButton>

                <FocusButton
                  focusId="player-seek-fwd"
                  onClick={() => seekRelative(30)}
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                >
                  30s ⏩
                </FocusButton>

                {nextEpisode && (
                  <FocusButton
                    focusId="player-next-ep"
                    onClick={() => player.play(nextEpisode)}
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                  >
                    Sonraki ⏭
                  </FocusButton>
                )}

                {/* Track selector toggle */}
                {(player.audioTracks.length > 0 || player.subtitleTracks.length > 0) && (
                  <FocusButton
                    focusId="player-tracks-toggle"
                    onClick={() => setShowTracks(v => !v)}
                    variant="ghost"
                    className="ml-auto text-white hover:bg-white/20"
                  >
                    🎵 Ses / Altyazı
                  </FocusButton>
                )}
              </div>

              {/* Track panel */}
              {showTracks && (
                <FocusScope id="player-tracks" onBack={() => setShowTracks(false)}>
                  <div className="mt-4 bg-black/70 rounded-lg p-4 flex gap-8">
                    {player.audioTracks.length > 0 && (
                      <div>
                        <p className="text-gray-400 text-sm mb-2 font-semibold">SES</p>
                        <div className="flex flex-col gap-1">
                          {player.audioTracks.map(track => (
                            <FocusButton
                              key={track.id}
                              focusId={`audio-track-${track.id}`}
                              onClick={() => player.audio({ track: track.id })}
                              variant={player.currentAudioTrack === track.id ? 'default' : 'ghost'}
                              size="sm"
                              className={player.currentAudioTrack === track.id
                                ? 'bg-red-600 hover:bg-red-700 justify-start'
                                : 'text-white hover:bg-white/20 justify-start'
                              }
                            >
                              {track.name}
                            </FocusButton>
                          ))}
                        </div>
                      </div>
                    )}

                    {player.subtitleTracks.length > 0 && (
                      <div>
                        <p className="text-gray-400 text-sm mb-2 font-semibold">ALTYAZI</p>
                        <div className="flex flex-col gap-1">
                          <FocusButton
                            focusId="subtitle-track-off"
                            onClick={() => player.subtitle({ track: -1 })}
                            variant={player.currentSubtitleTrack === -1 ? 'default' : 'ghost'}
                            size="sm"
                            className={player.currentSubtitleTrack === -1
                              ? 'bg-red-600 hover:bg-red-700 justify-start'
                              : 'text-white hover:bg-white/20 justify-start'
                            }
                          >
                            Kapalı
                          </FocusButton>
                          {player.subtitleTracks.map(track => (
                            <FocusButton
                              key={track.id}
                              focusId={`subtitle-track-${track.id}`}
                              onClick={() => player.subtitle({ track: track.id })}
                              variant={player.currentSubtitleTrack === track.id ? 'default' : 'ghost'}
                              size="sm"
                              className={player.currentSubtitleTrack === track.id
                                ? 'bg-red-600 hover:bg-red-700 justify-start'
                                : 'text-white hover:bg-white/20 justify-start'
                              }
                            >
                              {track.name}
                            </FocusButton>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </FocusScope>
              )}
            </div>
          </div>
        )}
      </div>
    </FocusScope>
  )
}
