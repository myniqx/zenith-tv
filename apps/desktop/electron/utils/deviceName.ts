import os from 'os';

/**
 * Get the default device name based on the system hostname
 * @returns Device name in format: "hostname (Zenith TV)"
 */
export function getDefaultDeviceName(): string {
  const hostname = os.hostname();
  return `${hostname} (Zenith TV)`;
}
