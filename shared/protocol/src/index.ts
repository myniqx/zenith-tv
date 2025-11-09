/**
 * WebSocket protocol implementation for Zenith TV peer-to-peer communication
 */

import type { WSMessage, Device } from '@zenith-tv/types';

export const PROTOCOL_VERSION = '1.0.0';
export const DEFAULT_PORT = 8765;
export const MDNS_SERVICE_TYPE = '_zenith-tv._tcp.local';

/**
 * Serialize message for transmission
 */
export function serializeMessage(message: WSMessage): string {
  return JSON.stringify({
    version: PROTOCOL_VERSION,
    timestamp: Date.now(),
    payload: message,
  });
}

/**
 * Deserialize received message
 */
export function deserializeMessage(data: string): WSMessage | null {
  try {
    const parsed = JSON.parse(data);

    if (parsed.version !== PROTOCOL_VERSION) {
      console.warn(`Protocol version mismatch: ${parsed.version} vs ${PROTOCOL_VERSION}`);
    }

    return parsed.payload as WSMessage;
  } catch (error) {
    console.error('Failed to deserialize message:', error);
    return null;
  }
}

/**
 * Generate device ID
 */
export function generateDeviceId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate pairing PIN
 */
export function generatePairingPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Validate WebSocket message
 */
export function validateMessage(message: unknown): message is WSMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const msg = message as any;
  return typeof msg.type === 'string';
}

/**
 * Get mDNS service name for device
 */
export function getMDNSServiceName(device: Device): string {
  return `${device.name.replace(/\s+/g, '-')}-${device.id.substring(0, 8)}`;
}
