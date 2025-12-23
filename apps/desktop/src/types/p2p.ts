import { UserData, M3UUpdateData, M3UStats } from '../stores/content';

export interface P2PConnection {
  id: string;
  ip: string;
  deviceName?: string; // Optional, if provided during handshake
}

export interface P2PMessage<T = unknown> {
  type: string;
  payload?: T;
}

// Generic Event Data (received from Electron)
export interface P2PEventData {
  connectionId: string;
  message: P2PMessage;
}

// ============================================
// Profile Sync Types (P2P Profile Synchronization)
// ============================================

export interface ProfileInfo {
  username: string;
  uuid: string;
  url: string;
}

export interface M3UDataSync {
  source: string;
  update: M3UUpdateData;
  stats: M3UStats;
}

export interface ProfileSyncPayload {
  profile?: ProfileInfo;
  request?: 'full';
  m3uData?: M3UDataSync;
  userData?: UserData;
}
