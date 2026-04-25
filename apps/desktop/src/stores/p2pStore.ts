import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { p2p } from '../libs/p2p';
import { P2PConnection, P2PMessage, ProfileSyncPayload } from '../../../../shared/content/src/types/p2p';
import { PairingRequestPayload } from '../types/p2p-payloads';
import { httpDiscovery, DiscoveredController } from '../services/httpDiscovery';

// Extend payload to include connectionId for internal tracking
interface PendingPairingRequest extends PairingRequestPayload {
  connectionId: string;
}

// Module-scope handler for client-mode inbound messages. See
// setClientMessageHandler doc comment in the store interface.
let clientMessageHandler: ((message: P2PMessage) => void) | null = null;

export type HandshakeStatus = 'pending' | 'completed' | 'timedOut';

export interface TrustedClient {
  deviceId: string;
  deviceName: string;
  trustedAt: number;
}

// Trusted server for pairing and auto-connect
export interface TrustedServer {
  deviceId: string;
  deviceName: string;
  lastIp: string;
  lastPort: number;
  autoConnect: boolean;
  pairedAt: number;
}

type P2PMode = 'off' | 'server' | 'client';
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface P2PStoreState {
  mode: P2PMode;
  isServerRunning: boolean; // Kept for compatibility, true if mode === 'server'
  connectionStatus: ConnectionStatus;

  // P2P Settings (moved from settings store)
  deviceName: string;
  serverPort: number;
  autoConnect: boolean;
  trustedServers: TrustedServer[];

  // Server specific
  deviceInfo: { id: string; name: string; port: number } | null;
  connections: P2PConnection[];
  lastConnection: P2PConnection | null;
  selectedDeviceId: string | null;
  pairingRequest: PendingPairingRequest | null;
  trustedClients: TrustedClient[];
  lastReceivedMessage: { connectionId: string; message: P2PMessage; timestamp: number } | null;
  lastProfileSync: { connectionId: string; payload: ProfileSyncPayload; timestamp: number } | null;

  // Client specific
  serverUrl: string;
  clientSocket: WebSocket | null;
  discoveredServers: DiscoveredController[];
  isScanning: boolean;

  // Actions
  setMode: (mode: P2PMode) => void;
  startServer: (port?: number) => Promise<void>;
  stopServer: () => Promise<void>;
  connectToServer: (ip: string, port: number) => Promise<void>;
  disconnectClient: () => void;

  selectDevice: (deviceId: string | null) => void;
  acceptPairing: () => Promise<void>;
  rejectPairing: () => Promise<void>;
  // Using if this device is web client and player!
  sendToRemote: <T = unknown>(message: P2PMessage<T>) => Promise<boolean>;
  // Using if this device is web server and remote!
  sendToPlayer: <T = unknown>(message: P2PMessage<T>, toIds?: string[]) => Promise<boolean>;

  // Discovery actions
  startScanning: () => Promise<void>;
  stopScanning: () => void;
  connectToDiscoveredServer: (deviceId: string) => Promise<void>;

  // P2P Settings actions (moved from settings store)
  setDeviceName: (name: string) => void;
  setServerPort: (port: number) => void;
  setAutoConnect: (enabled: boolean) => void;
  addTrustedServer: (server: TrustedServer) => void;
  removeTrustedServer: (deviceId: string) => void;
  updateTrustedServer: (deviceId: string, updates: Partial<TrustedServer>) => void;
  trustClient: (connectionId: string) => void;
  removeTrustedClient: (deviceId: string) => void;
  isTrustedClient: (deviceId: string) => boolean;
  updateConnectionHandshake: (connectionId: string, deviceId: string, deviceName: string) => void;
  closeConnection: (connectionId: string) => Promise<void>;

  // Internal
  handlePlayerConnection: (connection: P2PConnection) => void;
  handlePlayerDisconnection: (connectionId: string) => void;
  _handleMessage: (connectionId: string, message: P2PMessage) => void;

  // Client-mode inbound command handler. Registered by the VLC layer so
  // p2pStore stays decoupled from vlcPlayerStore (avoids an import cycle).
  // Called for every message received while mode === 'client', EXCEPT
  // pair_request / profile_sync which p2pStore handles itself.
  setClientMessageHandler: (handler: ((message: P2PMessage) => void) | null) => void;
}

export const useP2PStore = create<P2PStoreState>()(
  persist(
    (set, get) => ({
      mode: 'off',
      isServerRunning: false,
      connectionStatus: 'disconnected',

      // P2P Settings (moved from settings store)
      deviceName: 'Zenith TV',
      serverPort: 8080,
      autoConnect: true,
      trustedServers: [],

      deviceInfo: null,
      connections: [],
      lastConnection: null,
      selectedDeviceId: null,
      pairingRequest: null,
      trustedClients: [],
      lastReceivedMessage: null,
      lastProfileSync: null,

      serverUrl: '',
      clientSocket: null,
      discoveredServers: [],
      isScanning: false,

      setMode: (mode) => {
        const currentMode = get().mode;
        if (currentMode === mode) return;

        // Cleanup previous mode
        if (currentMode === 'server') {
          get().stopServer();
        } else if (currentMode === 'client') {
          get().disconnectClient();
        }

        set({ mode });
      },

      startServer: async (port?: number) => {
        try {
          const { deviceName, serverPort } = get();
          const actualPort = port ?? serverPort;
          const success = await p2p.start(actualPort, deviceName);
          if (success) {
            const info = await p2p.getDeviceInfo();
            set({
              mode: 'server',
              isServerRunning: true,
              deviceInfo: info,
              connectionStatus: 'connected' // Server is "connected" to the network
            });

            // Setup listeners
            p2p.onConnection(get().handlePlayerConnection);
            p2p.onDisconnection(get().handlePlayerDisconnection);
            p2p.onMessage(({ connectionId, message }) => get()._handleMessage(connectionId, message));
          }
        } catch (error) {
          console.error('[P2PStore] Failed to start server:', error);
          set({ connectionStatus: 'error' });
        }
      },

      stopServer: async () => {
        await p2p.stop();
        set({
          isServerRunning: false,
          connections: [],
          selectedDeviceId: null,
          deviceInfo: null,
          connectionStatus: 'disconnected'
        });
      },

      connectToServer: async (ip, port) => {
        set({ connectionStatus: 'connecting' });
        const url = `ws://${ip}:${port}`;

        try {
          const socket = new WebSocket(url);

          socket.onopen = () => {
            set({
              connectionStatus: 'connected',
              clientSocket: socket,
              serverUrl: url
            });

            // Send discovery/identify message
            // We can send our device info here if needed
          };

          socket.onmessage = (event) => {
            try {
              const message = JSON.parse((event as { data: string }).data) as P2PMessage;
              // In client mode, we treat the server as connectionId 'server'
              get()._handleMessage('server', message);
            } catch (e) {
              console.error('Failed to parse message:', e);
            }
          };

          socket.onclose = () => {
            set({
              connectionStatus: 'disconnected',
              clientSocket: null
            });
          };

          socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            set({ connectionStatus: 'error' });
          };

        } catch (error) {
          console.error('Failed to connect:', error);
          set({ connectionStatus: 'error' });
        }
      },

      disconnectClient: () => {
        const { clientSocket } = get();
        if (clientSocket) {
          clientSocket.close();
        }
        set({
          clientSocket: null,
          connectionStatus: 'disconnected'
        });
      },

      selectDevice: (deviceId) => {
        set({ selectedDeviceId: deviceId });
      },

      acceptPairing: async () => {
        const { pairingRequest, deviceInfo } = get();
        if (!pairingRequest) return;

        // Send accept response
        await p2p.send(pairingRequest.connectionId, {
          type: 'pair_response',
          payload: {
            accepted: true,
            deviceId: deviceInfo?.id,
            deviceName: deviceInfo?.name
          }
        });

        // Update connection info with device name
        set((state) => ({
          connections: state.connections.map(c =>
            c.id === pairingRequest.connectionId
              ? { ...c, deviceName: pairingRequest.deviceName }
              : c
          ),
          pairingRequest: null
        }));

        // Select the newly paired device
        set({ selectedDeviceId: pairingRequest.connectionId });
      },

      rejectPairing: async () => {
        const { pairingRequest, deviceInfo } = get();
        if (!pairingRequest) return;

        // Send reject response
        await p2p.send(pairingRequest.connectionId, {
          type: 'pair_response',
          payload: {
            accepted: false,
            deviceId: deviceInfo?.id
          }
        });

        set({ pairingRequest: null });
      },

      sendToRemote: async (message) => {
        const { mode, clientSocket } = get();

        if (mode === 'client') {
          if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify(message));
            return true;
          }
        }
        return false;
      },

      sendToPlayer: async (message, toIds = []) => {
        const { mode, selectedDeviceId } = get();

        if (mode === 'server') {
          if (!toIds.length) {
            if (!selectedDeviceId) return false;
            return await p2p.send(selectedDeviceId, message);
          }
          let result = true;
          for (const id of toIds) {
            result = result && await p2p.send(id, message);
          }
          return result;
        }
        return false;
      },

      handlePlayerConnection: async (connection) => {
        const conn: P2PConnection = { ...connection, handshake: 'pending' };
        set((state) => ({
          connections: [...state.connections, conn],
          lastConnection: conn,
          selectedDeviceId: state.selectedDeviceId ?? conn.id,
        }));
      },

      handlePlayerDisconnection: (connectionId) => {
        set((state) => ({
          connections: state.connections.filter(c => c.id !== connectionId),
          selectedDeviceId: state.selectedDeviceId === connectionId ? null : state.selectedDeviceId
        }));
      },

      _handleMessage: (connectionId, message) => {
        const { type, payload } = message;

        console.log('[P2PManager] Received message:', message);

        // Update lastReceivedMessage for subscribers
        set({ lastReceivedMessage: { connectionId, message, timestamp: Date.now() } });

        if (type === 'handshake_response') {
          const { deviceId, deviceName } = payload as { deviceId: string; deviceName: string };
          get().updateConnectionHandshake(connectionId, deviceId, deviceName);
          return;
        }

        if (type === 'pair_request') {
          const pairingPayload = payload as PairingRequestPayload;
          set({
            pairingRequest: {
              ...pairingPayload,
              connectionId
            }
          });
          return;
        }

        if (type === 'profile_sync') {
          const profilePayload = payload as ProfileSyncPayload;
          set({
            lastProfileSync: {
              connectionId,
              payload: profilePayload,
              timestamp: Date.now()
            }
          });
          return;
        }

        // Client mode: forward every remaining message (open/playback/
        // audio/video/subtitle/window/shortcut/state_request) to the VLC
        // layer via the registered handler.
        if (get().mode === 'client' && clientMessageHandler) {
          clientMessageHandler(message);
        }
      },

      setClientMessageHandler: (handler) => {
        clientMessageHandler = handler;
      },

      startScanning: async () => {
        set({ isScanning: true });

        try {
          const servers = await httpDiscovery.scan();
          set({ discoveredServers: servers });

          // Auto-connect logic
          const { autoConnect, trustedServers } = get();
          if (autoConnect && servers.length > 0) {
            for (const server of servers) {
              const trusted = trustedServers.find(
                (ts) => ts.deviceId === server.deviceId && ts.autoConnect
              );

              if (trusted) {
                console.log(`[P2P] Auto-connecting to ${server.deviceName}`);
                await get().connectToServer(server.ip, server.port);
                break; // Connect to first trusted server found
              }
            }
          }
        } catch (error) {
          console.error('[P2P] Scan failed:', error);
        } finally {
          set({ isScanning: false });
        }
      },

      stopScanning: () => {
        httpDiscovery.stopScan();
        set({ isScanning: false });
      },

      connectToDiscoveredServer: async (deviceId) => {
        const server = get().discoveredServers.find((s) => s.deviceId === deviceId);
        if (!server) {
          console.warn(`[P2P] Server not found: ${deviceId}`);
          return;
        }

        await get().connectToServer(server.ip, server.port);
      },

      // P2P Settings actions (moved from settings store)
      setDeviceName: (name) => set({ deviceName: name }),

      setServerPort: (port) => set({ serverPort: port }),

      setAutoConnect: (enabled) => set({ autoConnect: enabled }),

      addTrustedServer: (server) =>
        set((state) => ({
          trustedServers: [...state.trustedServers, server],
        })),

      removeTrustedServer: (deviceId) =>
        set((state) => ({
          trustedServers: state.trustedServers.filter((s) => s.deviceId !== deviceId),
        })),

      updateTrustedServer: (deviceId, updates) =>
        set((state) => ({
          trustedServers: state.trustedServers.map((s) =>
            s.deviceId === deviceId ? { ...s, ...updates } : s
          ),
        })),

      isTrustedClient: (deviceId) =>
        get().trustedClients.some((c) => c.deviceId === deviceId),

      trustClient: (connectionId) => {
        const conn = get().connections.find((c) => c.id === connectionId);
        if (!conn?.deviceId) return;
        const { deviceId, deviceName = 'Unknown Device' } = conn;
        if (!get().isTrustedClient(deviceId)) {
          set((state) => ({
            trustedClients: [...state.trustedClients, {
              deviceId,
              deviceName,
              trustedAt: Date.now(),
            }],
          }));
        }
        // Cancel handshake timer and mark completed
        p2p.handshakeCompleted(connectionId);
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === connectionId ? { ...c, handshake: 'completed' as const } : c
          ),
        }));
      },

      removeTrustedClient: (deviceId) =>
        set((state) => ({
          trustedClients: state.trustedClients.filter((c) => c.deviceId !== deviceId),
        })),

      updateConnectionHandshake: (connectionId, deviceId, deviceName) => {
        p2p.handshakeCompleted(connectionId);
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === connectionId
              ? { ...c, deviceId, deviceName, handshake: 'completed' as const }
              : c
          ),
        }));
        // If already trusted → state_request + welcome handled by P2PManager via lastConnection update
        const isTrusted = get().isTrustedClient(deviceId);
        const conn = get().connections.find((c) => c.id === connectionId);
        if (isTrusted && conn) {
          set({ lastConnection: { ...conn, deviceId, deviceName, handshake: 'completed' } });
          p2p.send(connectionId, { type: 'state_request' });
        }
      },

      closeConnection: async (connectionId) => {
        await p2p.closeConnection(connectionId);
      },
    }),
    {
      name: 'zenith-p2p',
      partialize: (state) => ({
        deviceName: state.deviceName,
        serverPort: state.serverPort,
        autoConnect: state.autoConnect,
        trustedServers: state.trustedServers,
        trustedClients: state.trustedClients,
      }),
    }
  )
);
