import { useEffect, useRef } from 'react';
import { useP2PClientStore } from '../../stores/p2pClientStore';
import { useTizenPlayerStore } from '../../stores/tizenPlayer';
import { useProfilesStore } from '../../stores/profiles';
import { useContentStore } from '../../stores/content';
import type {
  PlaybackOptions,
  AudioOptions,
  VideoOptions,
  SubtitleOptions,
  WindowOptions,
  OpenOptions,
  ShortcutOptions,
} from '@zenith-tv/content';
import { ProfileSyncPayload, mergeUserData } from '@zenith-tv/content';

// Tizen has no central player event stream (unlike VLC's event callback),
// so we can't forward per-change events like the desktop client does.
// Instead, we send a full VlcEventData snapshot on a fixed interval.
const STATE_BROADCAST_INTERVAL_MS = 500;

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
      case 'state_request':
        // Server wants a full snapshot right now — respond with a client_event.
        sendMessage({
          type: 'client_event',
          payload: useTizenPlayerStore.getState().getFullVlcEvent(),
        });
        break;
      case 'profile_sync':
        handleProfileSync(payload as ProfileSyncPayload, sendMessage);
        break;
    }
  }, [lastReceivedMessage]);

  // Flush accumulated player events to desktop on a fixed interval.
  // Only sends if something actually changed since the last flush.
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    const flushAndSend = () => {
      const event = useTizenPlayerStore.getState().flushPendingEvent();
      if (event) {
        sendMessage({ type: 'client_event', payload: event });
      }
    };

    broadcastTimerRef.current = setInterval(flushAndSend, STATE_BROADCAST_INTERVAL_MS);

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

    // Select profile using Tizen's own UUID for this URL (not the desktop's UUID).
    // Desktop and Tizen generate UUIDs independently; using the desktop UUID here
    // would cause setContent to look for a non-existent local directory.
    const localUUID = profilesStore.getUUIDFromURL(url);
    await profilesStore.selectProfile(username, localUUID ?? undefined);

    if (!m3uExists) {
      // Request full M3U data from desktop.
      // Return early — the welcome message also carries userData but we must
      // not process it yet: sending both request:'full' and userData back-to-back
      // causes the desktop's lastProfileSync to be overwritten by the second
      // message before React processes the first, so request:'full' is lost.
      // userData will be handled after M3U download completes.
      sendMessage({
        type: 'profile_sync',
        payload: { request: 'full' },
      });
      return;
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

