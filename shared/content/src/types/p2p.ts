import { M3UStats, M3UUpdateData, UserData } from "../stores/content";


export type HandshakeStatus = 'pending' | 'completed' | 'timedOut';

export interface P2PConnection {
  id: string;
  ip: string;
  deviceId?: string;
  deviceName?: string;
  handshake: HandshakeStatus;
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

// ============================================
// Player State Sync (P2P — client ⇄ server)
// ============================================
//
// The client (desktop VLC or Tizen AVPlay) forwards player state to the
// server using the `client_event` message type. The server mirrors these
// into its own player store without running a local player.
//
// On initial connection — and any time the server needs a resync — the
// server sends `state_request`. The client responds with a single
// `client_event` that carries the full current state: a snapshot combining
// mediaInfo + playerInfo + currentVideo. The mediaInfo.url field is
// populated so the server can resolve currentItem from its own M3U content
// store via findByUrl.

// state_request is a payload-less command — the client simply responds
// with a full snapshot. Kept as a type alias so it shows up in grep and
// can gain fields later without touching call sites.
export type StateRequestPayload = Record<string, never>;
