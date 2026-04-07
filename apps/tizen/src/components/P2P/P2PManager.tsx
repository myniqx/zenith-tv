import { useEffect, useRef } from 'react';
import { useP2PClientStore } from '../../stores/p2pClientStore';
import { useTizenPlayerStore } from '../../stores/tizenPlayer';
import { useProfilesStore } from '../../stores/profiles';
import { useContentStore } from '../../stores/content';
import {
  PlaybackOptions,
  AudioOptions,
  VideoOptions,
  SubtitleOptions,
  WindowOptions,
  OpenOptions,
  ShortcutOptions,
} from '../../stores/types/player-types';
import { ProfileSyncPayload, mergeUserData } from '@zenith-tv/content';

const STATE_BROADCAST_INTERVAL_MS = 2000;

export function P2PManager() {
  const {
    autoConnect,
    scan,
    sendMessage,
    lastReceivedMessage,
    connectionStatus,
  } = useP2PClientStore();

  const playerStore = useTizenPlayerStore();
  const broadcastTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial scan if auto-connect is enabled
  useEffect(() => {
    if (autoConnect) {
      scan();
    }
  }, []);

  // Handle incoming commands from desktop
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
      case 'shortcut':
        playerStore.shortcut(payload as ShortcutOptions);
        break;
      case 'state_update':
        // Tizen is the player — ignore state_update coming from desktop
        break;
      case 'profile_sync':
        handleProfileSync(payload as ProfileSyncPayload, sendMessage);
        break;
    }
  }, [lastReceivedMessage]);

  // Sync player state to desktop on a fixed interval (throttled)
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    const broadcastState = () => {
      const state = useTizenPlayerStore.getState();
      sendMessage({
        type: 'state_update',
        payload: {
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
          rate: state.rate,
          error: state.error,
          currentItem: state.currentItem,
        },
      });
    };

    broadcastTimerRef.current = setInterval(broadcastState, STATE_BROADCAST_INTERVAL_MS);

    return () => {
      if (broadcastTimerRef.current) {
        clearInterval(broadcastTimerRef.current);
        broadcastTimerRef.current = null;
      }
    };
  }, [connectionStatus, sendMessage]);

  return null;
}

async function handleProfileSync(
  payload: ProfileSyncPayload,
  sendMessage: ReturnType<typeof useP2PClientStore.getState>['sendMessage']
) {
  if (!payload) return;

  const profilesStore = useProfilesStore.getState();
  const contentStore = useContentStore.getState();

  // Desktop requests full profile data — not applicable, Tizen is the receiver
  if (payload.request === 'full') {
    console.log('[P2P] Desktop requested full profile sync — not applicable on Tizen');
    return;
  }

  // Desktop pushes profile info → create/select profile, request M3U if missing
  if (payload.profile) {
    const { username, uuid, url } = payload.profile;

    const existingUUID = profilesStore.getUUIDFromURL(url);
    const m3uExists = !!existingUUID;

    const existingProfile = profilesStore.getProfile(username);
    if (!existingProfile) {
      profilesStore.createProfile(username);
    }

    if (!m3uExists) {
      profilesStore.addM3UToProfile(username, url);
    }

    // Select profile so content store knows the active UUID
    await profilesStore.selectProfile(username, uuid);

    if (!m3uExists) {
      // Request full M3U data from desktop
      sendMessage({
        type: 'profile_sync',
        payload: { request: 'full' },
      });
    } else {
      // M3U already on disk — just reload
      await contentStore.load();
    }
  }

  // Desktop sends M3U source + update + stats → write to disk and reload
  if (payload.m3uData) {
    const { source: m3uUrl, update, stats } = payload.m3uData;
    const uuid = profilesStore.getUUIDFromURL(m3uUrl) ?? profilesStore.getCurrentUUID();

    if (uuid) {
      await contentStore.syncM3UData(uuid, m3uUrl, update, stats);
      await contentStore.load();
    }
  }

  // Desktop sends userData → merge (timestamp-based) and send merged back
  if (payload.userData) {
    const localUserData = contentStore.userData;
    const mergedUserData = mergeUserData(localUserData, payload.userData);

    await contentStore.setUserData(mergedUserData);

    // Send merged data back to desktop so both sides are in sync
    sendMessage({
      type: 'profile_sync',
      payload: { userData: mergedUserData },
    });
  }
}

