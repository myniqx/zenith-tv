import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { p2p } from '../libs/p2p';
import { P2PConnection, P2PMessage, ProfileSyncPayload } from '../types/p2p';
import { PairingRequestPayload } from '../types/p2p-payloads';
import { httpDiscovery, DiscoveredController } from '../services/httpDiscovery';

// Extend payload to include connectionId for internal tracking
interface PendingPairingRequest extends PairingRequestPayload {
  connectionId: string;
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
  broadcastState: <T>(state: T) => void;

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

  // Internal
  handlePlayerConnection: (connection: P2PConnection) => void;
  handlePlayerDisconnection: (connectionId: string) => void;
  _handleMessage: (connectionId: string, message: P2PMessage) => void;
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

      broadcastState: (state) => {
        const { mode, clientSocket } = get();
        if (mode === 'client' && clientSocket && clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({
            type: 'state_update',
            payload: state
          }));
        }
      },

      handlePlayerConnection: async (connection) => {
        set((state) => ({
          connections: [...state.connections, connection],
          lastConnection: connection
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

        if (type === 'pair_request') {
          const pairingPayload = payload as PairingRequestPayload;
          set({
            pairingRequest: {
              ...pairingPayload,
              connectionId
            }
          });
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
        }
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
    }),
    {
      name: 'zenith-p2p',
      partialize: (state) => ({
        // Only persist user preferences
        deviceName: state.deviceName,
        serverPort: state.serverPort,
        autoConnect: state.autoConnect,
        trustedServers: state.trustedServers,
      }),
    }
  )
);
