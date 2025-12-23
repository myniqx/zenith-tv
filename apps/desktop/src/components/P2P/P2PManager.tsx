import { useEffect } from 'react';
import { useP2PStore } from '../../stores/p2pStore';
import { useVlcPlayerStore } from '../../stores/vlcPlayer';
import { useContentStore } from '../../stores/content';
import { useProfilesStore } from '../../stores/profiles';
import { PlaybackOptions, AudioOptions, VideoOptions, SubtitleOptions, WindowOptions, ShortcutOptions } from '../../types/types';
import { ProfileSyncPayload, ProfileInfo } from '../../types/p2p';
import { mergeUserData } from '../../utils/profileSync';
import { fileSystem } from '../../libs/fileSystem';

export function P2PManager() {
  const { mode, connectionStatus, broadcastState, lastReceivedMessage, lastProfileSync, sendProfileSync } = useP2PStore();
  const vlcStore = useVlcPlayerStore();
  const contentStore = useContentStore();
  const profilesStore = useProfilesStore();


  // Handle incoming commands (RemoteController -> PlayerDevice)
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
        vlcStore.open(payload as any);
        break;
      case 'profile_sync':
        handleProfileSync(payload as ProfileSyncPayload);
        break;
    }
  }, [lastReceivedMessage, mode, vlcStore]);

  // Handle profile synchronization (Client side)
  const handleProfileSync = async (payload: ProfileSyncPayload) => {
    console.log('[P2PManager] Received profile_sync:', payload);

    // Received profile info - create/update profile and request full sync
    if (payload.profile) {
      const { username, uuid, url } = payload.profile;

      // Check if M3U already exists (might be added to different profile)
      const m3uExists = await fileSystem.exists(`m3u/${uuid}/source.m3u`);

      // Check if profile exists
      const existingProfile = profilesStore.profiles.find((p) => p.username === username);

      if (!existingProfile) {
        profilesStore.createProfile(username);
        profilesStore.addM3UToProfile(username, url);
        console.log('[P2PManager] Created new profile:', username);
      }

      // Select the profile (new or existing)
      await profilesStore.selectProfile(username, uuid);
      console.log('[P2PManager] Selected profile:', username);

      // Request full sync only if M3U doesn't exist
      if (!m3uExists) {
        await sendProfileSync({ request: 'full' });
        console.log('[P2PManager] Requested full sync from server');
      } else {
        console.log('[P2PManager] M3U already exists, skipping download');
        // Load existing content
        await contentStore.load();
      }
    }

    // Received M3U data - save to disk
    if (payload.m3uData) {
      const currentUUID = profilesStore.getCurrentUUID();
      if (!currentUUID) {
        console.warn('[P2PManager] No active profile to save M3U data');
        return;
      }

      const { source, update, stats } = payload.m3uData;
      await contentStore.syncM3UData(currentUUID, source, update, stats);
      console.log('[P2PManager] Saved M3U data to disk');

      // Reload content from disk
      await contentStore.load();
      console.log('[P2PManager] Reloaded content from disk');
    }

    // Received user data - merge with local data
    if (payload.userData) {
      const localUserData = contentStore.userData;
      // mergeUserData handles empty local data correctly (uses remote data)
      const mergedUserData = mergeUserData(localUserData, payload.userData);

      // Update local store with merged data
      await contentStore.setUserData(mergedUserData);
      console.log('[P2PManager] Merged and saved userData');

      // Send merged data back to server
      await sendProfileSync({ userData: mergedUserData });
      console.log('[P2PManager] Sent merged userData back to server');
    }
  };

  // Handle profile sync requests (Server side)
  useEffect(() => {
    if (mode !== 'server' || !lastProfileSync) return;

    const { payload } = lastProfileSync;

    // Client requested full sync
    if (payload.request === 'full') {
      handleProfileSyncRequest();
    }

    // Client sent userData for merging
    if (payload.userData) {
      handleUserDataMerge(payload.userData);
    }
  }, [lastProfileSync, mode]);

  // Handle profile sync request from client (Server side)
  const handleProfileSyncRequest = async () => {
    console.log('[P2PManager] Client requested full profile sync');

    const currentUsername = profilesStore.getCurrentUsername();
    const currentUUID = profilesStore.getCurrentUUID();

    if (!currentUsername || !currentUUID) {
      console.warn('[P2PManager] No active profile to sync');
      return;
    }

    // Get profile M3U URL
    const profile = profilesStore.profiles.find((p) => p.username === currentUsername);
    if (!profile) {
      console.warn('[P2PManager] Profile not found');
      return;
    }

    // Send all data in one message for efficiency
    try {
      const source = await fileSystem.readFile(`m3u/${currentUUID}/source.m3u`);
      const update = await fileSystem.readJSON(`m3u/${currentUUID}/update.json`);
      const stats = await fileSystem.readJSON(`m3u/${currentUUID}/stats.json`);
      const userData = contentStore.userData;

      await sendProfileSync({
        profile: {
          username: currentUsername,
          uuid: currentUUID,
          url: profile.m3uUrl
        },
        m3uData: { source, update, stats },
        userData
      });

      console.log('[P2PManager] Sent full profile sync data');
    } catch (error) {
      console.error('[P2PManager] Failed to load profile data:', error);
    }
  };

  // Handle user data merge from client (Server side)
  const handleUserDataMerge = async (remoteUserData: any) => {
    console.log('[P2PManager] Received userData from client, merging...');

    const localUserData = contentStore.userData;
    const mergedUserData = mergeUserData(localUserData, remoteUserData);

    // Update local store with merged data
    await contentStore.setUserData(mergedUserData);
    console.log('[P2PManager] Merged and saved userData');
  };

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
