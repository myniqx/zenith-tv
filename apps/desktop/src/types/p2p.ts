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
