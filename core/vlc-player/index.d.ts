/**
 * @zenith-tv/vlc-player - Native libVLC bindings for Electron
 */

export interface Track {
  id: number;
  name: string;
}

export type PlayerState =
  | 'idle'
  | 'opening'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'ended'
  | 'error'
  | 'unknown';

export type EventType = 'timeChanged' | 'stateChanged' | 'endReached' | 'error';

export interface TimeChangedCallback {
  (time: number): void;
}

export interface StateChangedCallback {
  (state: PlayerState): void;
}

export interface EndReachedCallback {
  (): void;
}

export interface ErrorCallback {
  (message: string): void;
}

export type EventCallback =
  | TimeChangedCallback
  | StateChangedCallback
  | EndReachedCallback
  | ErrorCallback;

export declare class VlcPlayer {
  constructor();

  /**
   * Set media source (URL or file path)
   * @param url - Media URL (http://, rtsp://, file://) or local file path
   */
  setMedia(url: string): void;

  /**
   * Start playback
   * @param url - Optional media URL to set and play
   * @returns true if playback started successfully
   */
  play(url?: string): boolean;

  /**
   * Toggle pause state
   */
  pause(): void;

  /**
   * Resume playback from paused state
   */
  resume(): void;

  /**
   * Stop playback
   */
  stop(): void;

  /**
   * Seek to position in milliseconds
   * @param time - Position in milliseconds
   */
  seek(time: number): void;

  /**
   * Set volume level
   * @param volume - Volume level (0-100)
   */
  setVolume(volume: number): void;

  /**
   * Get current volume level
   * @returns Volume level (0-100)
   */
  getVolume(): number;

  /**
   * Set mute state
   * @param mute - true to mute, false to unmute
   */
  setMute(mute: boolean): void;

  /**
   * Get mute state
   * @returns true if muted
   */
  getMute(): boolean;

  /**
   * Set playback rate
   * @param rate - Playback rate (1.0 = normal)
   */
  setRate(rate: number): void;

  /**
   * Get playback rate
   * @returns Current playback rate
   */
  getRate(): number;

  /**
   * Get current playback time
   * @returns Time in milliseconds
   */
  getTime(): number;

  /**
   * Get media duration
   * @returns Duration in milliseconds
   */
  getLength(): number;

  /**
   * Get playback position (0.0 - 1.0)
   * @returns Position as fraction
   */
  getPosition(): number;

  /**
   * Set playback position (0.0 - 1.0)
   * @param position - Position as fraction
   */
  setPosition(position: number): void;

  /**
   * Get current player state
   * @returns Player state string
   */
  getState(): PlayerState;

  /**
   * Check if currently playing
   * @returns true if playing
   */
  isPlaying(): boolean;

  /**
   * Check if media is seekable
   * @returns true if seekable
   */
  isSeekable(): boolean;

  /**
   * Get available audio tracks
   * @returns Array of audio tracks
   */
  getAudioTracks(): Track[];

  /**
   * Get current audio track ID
   * @returns Track ID or -1 if none
   */
  getAudioTrack(): number;

  /**
   * Set audio track
   * @param trackId - Track ID from getAudioTracks()
   * @returns true if successful
   */
  setAudioTrack(trackId: number): boolean;

  /**
   * Get available subtitle tracks
   * @returns Array of subtitle tracks
   */
  getSubtitleTracks(): Track[];

  /**
   * Get current subtitle track ID
   * @returns Track ID or -1 if disabled
   */
  getSubtitleTrack(): number;

  /**
   * Set subtitle track (-1 to disable)
   * @param trackId - Track ID from getSubtitleTracks()
   * @returns true if successful
   */
  setSubtitleTrack(trackId: number): boolean;

  /**
   * Set subtitle delay
   * @param delay - Delay in microseconds (positive = later, negative = earlier)
   * @returns true if successful
   */
  setSubtitleDelay(delay: number): boolean;

  /**
   * Get available video tracks
   * @returns Array of video tracks
   */
  getVideoTracks(): Track[];

  /**
   * Set native window handle for video rendering
   * @param handle - Window handle (HWND on Windows, XID on Linux, NSView on macOS)
   * @returns true if successful
   */
  setWindow(handle: Buffer | number): boolean;

  /**
   * Register event listener
   * @param event - Event type
   * @param callback - Event handler
   */
  on(event: 'timeChanged', callback: TimeChangedCallback): void;
  on(event: 'stateChanged', callback: StateChangedCallback): void;
  on(event: 'endReached', callback: EndReachedCallback): void;
  on(event: 'error', callback: ErrorCallback): void;

  /**
   * Remove event listener
   * @param event - Event type
   */
  off(event: EventType): void;

  /**
   * Release all resources
   */
  dispose(): void;
}

export default VlcPlayer;
