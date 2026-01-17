import { useEffect } from 'react';
import { useP2PClientStore } from '../../stores/p2pClientStore';
import { useTizenPlayerStore } from '../../stores/tizenPlayer';
import { PlaybackOptions, AudioOptions, VideoOptions, SubtitleOptions, WindowOptions, OpenOptions } from '../../stores/types/player-types';

export function P2PManager() {
  const {
    autoConnect,
    scan,
    sendMessage,
    lastReceivedMessage,
    connectionStatus
  } = useP2PClientStore();

  const playerStore = useTizenPlayerStore();

  // Initial scan if auto-connect is enabled
  useEffect(() => {
    if (autoConnect) {
      scan();
    }
  }, []); // Run once on mount

  // Handle incoming commands from Server
  useEffect(() => {
    if (!lastReceivedMessage) return;

    const { message } = lastReceivedMessage;
    const { type, payload } = message;

    switch (type) {
      case 'open':
        playerStore.open(payload as OpenOptions);
        break;
      case 'playback':
        playerStore.playback(payload as PlaybackOptions);
        break;
      case 'audio':
        playerStore.audio(payload as AudioOptions);
        break;
      case 'video':
        playerStore.video(payload as VideoOptions);
        break;
      case 'subtitle':
        playerStore.subtitle(payload as SubtitleOptions);
        break;
      case 'window':
        playerStore.window(payload as WindowOptions);
        break;
      case 'profile_sync':
        // TODO: Handle profile sync if needed (receiving M3U/UserData from desktop)
        console.log('[P2P] Profile sync not implemented yet');
        break;
    }

    console.log('[P2P] Received message:', message);
  }, [lastReceivedMessage]);

  // Sync Player State -> Server
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    // Subscribe to player state changes
    const unsub = useTizenPlayerStore.subscribe((state) => {
      // Create a payload compatible with VlcState
      const payload = {
        time: state.time,
        duration: state.duration,
        playerState: state.playerState,
        volume: state.volume,
        isMuted: state.isMuted,
        isInitialized: state.isInitialized,
        audioTracks: state.audioTracks,
        subtitleTracks: state.subtitleTracks,
        videoTracks: state.videoTracks,
        currentAudioTrack: state.currentAudioTrack,
        currentSubtitleTrack: state.currentSubtitleTrack,
        currentVideoTrack: state.currentVideoTrack,
        position: state.position,
        // ... add other relevant fields
      };

      sendMessage({
        type: 'state_update',
        payload
      });
    });

    return () => unsub();
  }, [connectionStatus, sendMessage]);

  return null;
}
