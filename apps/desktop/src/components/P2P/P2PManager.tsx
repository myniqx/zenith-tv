import { useEffect } from 'react';
import { useP2PStore } from '../../stores/p2pStore';
import { useVlcPlayerStore } from '../../stores/vlcPlayer';
import { PlaybackOptions, AudioOptions, VideoOptions, SubtitleOptions, WindowOptions, ShortcutOptions } from '../../types/types';

export function P2PManager() {
  const { mode, connectionStatus, broadcastState, lastReceivedMessage } = useP2PStore();
  const vlcStore = useVlcPlayerStore();

  // We need to listen to incoming messages from the store if we are in Client mode
  // But the store handles messages internally.
  // Wait, `p2pStore` has `_handleMessage`.
  // In `p2pStore.ts`, when we receive a message in Client mode, we call `_handleMessage`.
  // But `_handleMessage` currently only handles `pair_request`.
  // We need to handle commands like `play`, `pause` etc.

  // Let's hook into the store's message handling or add a listener.
  // Since we can't easily modify the store to emit events without a major refactor,
  // let's use a subscription to `lastMessage` if we added it, OR
  // we can just modify `p2pStore` to expose a way to register handlers?

  // Alternative: In `p2pStore`, we can add a `messageHandler` callback that we can set.
  // But that's messy.

  // Better: The `p2pStore` should just update state, and we react to it?
  // No, commands are events, not state.

  // Let's modify `p2pStore` to allow subscribing to messages.
  // Or simpler: We can just put the WebSocket logic HERE in P2PManager instead of the store?
  // The store should manage connection state, but maybe the socket handling is better here?
  // No, the store needs the socket to send commands.

  // Let's go with: `p2pStore` exposes `lastReceivedMessage` (timestamp + message).
  // We subscribe to it.

  // I need to update `p2pStore` first to expose `lastReceivedMessage`.

  // Handle incoming commands (Server -> Client)
  useEffect(() => {
    if (mode !== 'client' || !lastReceivedMessage) return;

    const { message } = lastReceivedMessage;
    const { type, payload } = message;

    // Map P2P messages to VLC store actions
    switch (type) {
      case 'playback':
        vlcStore.playback(payload as PlaybackOptions);
        break;
      case 'audio':
        vlcStore.audio(payload as AudioOptions);
        break;
      case 'video':
        vlcStore.video(payload as VideoOptions);
        break;
      case 'subtitle':
        vlcStore.subtitle(payload as SubtitleOptions);
        break;
      case 'window':
        vlcStore.window(payload as WindowOptions);
        break;
      case 'shortcut':
        vlcStore.shortcut(payload as ShortcutOptions);
        break;
      case 'open':
        // Handle open command (might need special handling for file paths vs URLs)
        // For now assume payload is string or OpenOptions
        vlcStore.open(payload as any);
        break;
    }
  }, [lastReceivedMessage, mode, vlcStore]);

  // Sync Logic (Client -> Server)
  useEffect(() => {
    if (mode !== 'client' || connectionStatus !== 'connected') return;

    // Subscribe to VLC store changes and broadcast them
    const unsub = useVlcPlayerStore.subscribe((state) => {
      // We should debounce this or only send significant changes
      // For now, let's send everything.
      // Optimization: Only send if changed?

      // We need to map VlcState to a payload
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
        // ... other fields
      };

      broadcastState(payload);
    });

    return () => unsub();
  }, [mode, connectionStatus, broadcastState]);

  return null;
}
