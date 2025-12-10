// Specific Message Payloads (for frontend usage)
export interface PairingRequestPayload {
  deviceId: string;
  deviceName: string;
  pin?: string; // If the client generates the PIN
}

export interface PlayCommandPayload {
  item?: unknown;
  position?: number;
}

export interface SeekCommandPayload {
  position: number;
}

export interface SetVolumeCommandPayload {
  volume: number;
}
