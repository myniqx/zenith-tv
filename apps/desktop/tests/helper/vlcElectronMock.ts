/**
 * VLC Electron Mock
 *
 * Replaces window.electron.vlc.* with a direct VlcProcessManager connection.
 * No Electron, no IPC — real VLC native addon runs in the standalone process.
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { VlcProcessManager } = require(
  path.resolve(__dirname, '../../electron/vlc/vlcProcessManager.cjs')
);

// Registered onEvent callbacks (replaces mainWindow.webContents.send)
const eventCallbacks: Array<(data: unknown) => void> = [];

// Registered onPositionChanged callbacks (replaces Electron window events)
const positionCallbacks: Array<(data: PositionData) => void> = [];

// Last window({ resize }) packet sent to VLC
let lastWindowResize: WindowResizeBounds | null = null;

let manager: typeof VlcProcessManager | null = null;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PositionData {
  x: number;
  y: number;
  scaleFactor: number;
  minimized: boolean;
}

export interface WindowResizeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Logging helpers ─────────────────────────────────────────────────────────

function logOut(method: string, payload: unknown) {
  console.log(`[VLC Mock →] ${method}`, JSON.stringify(payload, null, 2));
}

let lastTimeLogAt = 0;

function logIn(data: unknown) {
  // Throttle time-only currentVideo packets to once per 10 seconds
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (d.currentVideo && typeof d.currentVideo === 'object') {
      const cv = d.currentVideo as Record<string, unknown>;
      const keys = Object.keys(cv);
      const isTimeOnly = keys.every(k => k === 'time' || k === 'position' || k === 'buffering');
      if (isTimeOnly) {
        const now = Date.now();
        if (now - lastTimeLogAt < 10000) return;
        lastTimeLogAt = now;
      }
    }
  }
  console.log('[VLC Mock ←]', JSON.stringify(data, null, 2));
}

// Wrap manager.call so every outgoing command is logged.
// Also intercepts window({ resize }) to track last resize sent.
async function call(method: string, payload?: unknown): Promise<unknown> {
  logOut(method, payload ?? {});

  if (method === 'window' && payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    if (p.resize && typeof p.resize === 'object') {
      lastWindowResize = p.resize as WindowResizeBounds;
    }
  }

  return manager!.call(method, payload);
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

export async function setupVlcMock(): Promise<void> {
  lastWindowResize = null;
  positionCallbacks.length = 0;
  eventCallbacks.length = 0;

  // Point VlcProcessManager directly to the standalone script (bypasses dev/prod path logic)
  process.env.VLC_STANDALONE_SCRIPT = path.resolve(
    __dirname,
    '../../electron/vlc/vlcStandaloneProcess.cjs'
  );

  manager = new VlcProcessManager();
  await manager.start();

  // Forward VLC events directly to store listeners and log them
  manager.on('vlcEvent', (data: unknown) => {
    logIn(data);
    for (const cb of eventCallbacks) {
      cb(data);
    }
  });

  // Inject window.electron mock
  (globalThis as any).window = (globalThis as any).window ?? {};
  (globalThis as any).window.electron = {
    vlc: {
      isAvailable: () => call('init').then(() => true).catch(() => false),
      init: async () => {
        await call('init');
        return { success: true };
      },
      open: (options: unknown) => call('open', options),
      playback: (options: unknown) => call('playback', options),
      audio: (options: unknown) => call('audio', options),
      video: (options: unknown) => call('video', options),
      subtitle: (options: unknown) => call('subtitle', options),
      window: (options: unknown) => call('window', options),
      shortcut: (options: unknown) => call('shortcut', options),
      getMediaInfo: () => call('getMediaInfo'),
      onEvent: (cb: (data: unknown) => void) => {
        eventCallbacks.push(cb);
      },
    },
    window: {
      onPositionChanged: (cb: (data: PositionData) => void) => {
        positionCallbacks.push(cb);
      },
    },
    p2p: {
      start: async () => false,
      stop: async () => false,
      send: async () => false,
      broadcast: async () => { },
      getDeviceInfo: async () => null,
      onConnection: () => { },
      onMessage: () => { },
      onDisconnection: () => { },
    },
    platform: 'linux',
    version: '0.0.0-test',
    network: {
      getLocalIP: async () => '127.0.0.1',
    },
  };
}

export async function teardownVlcMock(): Promise<void> {
  eventCallbacks.length = 0;
  positionCallbacks.length = 0;
  lastWindowResize = null;
  if (manager) {
    await manager.stop();
    manager = null;
  }
}

// ─── Simulation helpers ───────────────────────────────────────────────────────

/**
 * Simulate the Electron main window moving to a new position.
 * Triggers the same callbacks that window.electron.window.onPositionChanged fires.
 */
export function triggerWindowMove(data: PositionData): void {
  for (const cb of positionCallbacks) {
    cb(data);
  }
}

/**
 * Returns the last window({ resize }) bounds sent to VLC, or null if none yet.
 */
export function getLastWindowResize(): WindowResizeBounds | null {
  return lastWindowResize;
}

/**
 * Reset the tracked last resize (useful between test cases).
 */
export function resetLastWindowResize(): void {
  lastWindowResize = null;
}

/**
 * Create a minimal fake HTMLElement whose getBoundingClientRect()
 * returns the given bounds. Used for setStickyElement in tests.
 */
export function makeFakeElement(rect: { x: number; y: number; width: number; height: number }): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.y,
      left: rect.x,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
      toJSON: () => rect,
    }),
  } as unknown as HTMLElement;
}

// ─── Wait helpers ─────────────────────────────────────────────────────────────

/**
 * Poll until predicate returns a truthy value, then resolve with it.
 * Rejects with a descriptive error after timeoutMs.
 */
export function waitFor<T>(
  predicate: () => T | undefined | null | false,
  description: string,
  timeoutMs = 15000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const result = predicate();
      if (result) {
        clearInterval(interval);
        clearTimeout(timeout);
        resolve(result as T);
      }
    }, 50);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Timeout (${timeoutMs}ms) waiting for: ${description}`));
    }, timeoutMs);
  });
}

/**
 * Wait until playerState matches one of the expected values.
 */
export function waitForState(
  getState: () => { playerState: string },
  expected: string[],
  timeoutMs = 15000
): Promise<string> {
  return waitFor(
    () => {
      const { playerState } = getState();
      return expected.includes(playerState) ? playerState : null;
    },
    `playerState to be [${expected.join(', ')}]`,
    timeoutMs
  );
}

/**
 * Wait until screenMode matches the expected value.
 */
export function waitForScreenMode(
  getState: () => { screenMode: string },
  expected: string,
  timeoutMs = 10000
): Promise<string> {
  return waitFor(
    () => {
      const { screenMode } = getState();
      return screenMode === expected ? screenMode : null;
    },
    `screenMode to be "${expected}"`,
    timeoutMs
  );
}

/**
 * Wait until getLastWindowResize() returns a non-null value.
 */
export function waitForWindowResize(timeoutMs = 5000): Promise<WindowResizeBounds> {
  return waitFor(
    () => lastWindowResize,
    'VLC to receive a window resize command',
    timeoutMs
  );
}
