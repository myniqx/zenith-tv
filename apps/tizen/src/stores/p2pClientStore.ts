import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { httpDiscovery, DiscoveredController } from '../lib/content';
import { P2PMessage } from '../lib/content';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface TrustedServer extends DiscoveredController {
  autoConnect: boolean;
  lastConnectedAt: number;
}

interface P2PClientState {
  // State
  connectionStatus: ConnectionStatus;
  autoConnect: boolean; // Global auto-connect setting
  trustedServers: TrustedServer[];
  discoveredServers: DiscoveredController[];
  isScanning: boolean;

  // Connection details
  currentServer: TrustedServer | null;
  serverUrl: string | null;
  socket: WebSocket | null;
  lastReceivedMessage: { message: P2PMessage; timestamp: number } | null;
  error: string | null;

  // Actions
  scan: () => Promise<void>;
  connect: (server: DiscoveredController | TrustedServer) => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: P2PMessage) => void;

  // Settings actions
  setAutoConnect: (enabled: boolean) => void;
  addTrustedServer: (server: DiscoveredController) => void;
  removeTrustedServer: (deviceId: string) => void;
  updateTrustedServer: (deviceId: string, updates: Partial<TrustedServer>) => void;

  // Internal
  _handleMessage: (message: P2PMessage) => void;
}

export const useP2PClientStore = create<P2PClientState>()(
  persist(
    (set, get) => ({
      connectionStatus: 'disconnected',
      autoConnect: true,
      trustedServers: [],
      discoveredServers: [],
      isScanning: false,

      currentServer: null,
      serverUrl: null,
      socket: null,
      lastReceivedMessage: null,
      error: null,

      scan: async () => {
        if (get().isScanning) return;

        set({ isScanning: true, error: null });
        try {
          const servers = await httpDiscovery.scan();
          set({ discoveredServers: servers });

          // Auto-connect logic if enabled and not already connected
          const { autoConnect, trustedServers, connectionStatus } = get();

          if (autoConnect && connectionStatus === 'disconnected' && servers.length > 0) {
            // Find a discovered server that is also trusted and has autoConnect enabled
            const serverToConnect = servers.find(server => {
              const trusted = trustedServers.find(ts => ts.deviceId === server.deviceId);
              return trusted && trusted.autoConnect;
            });

            if (serverToConnect) {
              console.log('[P2P] Auto-connecting to:', serverToConnect.deviceName);
              await get().connect(serverToConnect);
            }
          }

        } catch (error) {
          console.error('[P2P] Scan failed:', error);
          set({ error: 'Tarama başarısız oldu' });
        } finally {
          set({ isScanning: false });
        }
      },

      connect: async (server) => {
        // Disconnect if already connected
        const currentSocket = get().socket;
        if (currentSocket) {
          currentSocket.close();
        }

        set({ connectionStatus: 'connecting', error: null });

        const url = `ws://${server.ip}:${server.port}`;
        console.log('[P2P] Connecting to:', url);

        try {
          const socket = new WebSocket(url);

          socket.onopen = () => {
            console.log('[P2P] Connected');
            set({
              connectionStatus: 'connected',
              socket,
              serverUrl: url,
              error: null
            });

            // Add to trusted servers if not exists or update lastConnectedAt
            get().addTrustedServer(server);
          };

          socket.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data) as P2PMessage;
              get()._handleMessage(message);
            } catch (e) {
              console.error('[P2P] Failed to parse message:', e);
            }
          };

          socket.onclose = () => {
            console.log('[P2P] Disconnected');
            set({
              connectionStatus: 'disconnected',
              socket: null,
              serverUrl: null,
              currentServer: null
            });
          };

          socket.onerror = (error) => {
            console.error('[P2P] WebSocket error:', error);
            set({
              connectionStatus: 'error',
              error: 'Bağlantı hatası'
            });
          };

        } catch (error) {
          console.error('[P2P] Connection failed:', error);
          set({
            connectionStatus: 'error',
            error: 'Bağlantı kurulamadı'
          });
        }
      },

      disconnect: () => {
        const { socket } = get();
        if (socket) {
          socket.close();
        }
        set({
          connectionStatus: 'disconnected',
          socket: null,
          serverUrl: null,
          currentServer: null
        });
      },

      sendMessage: (message) => {
        const { socket, connectionStatus } = get();
        if (socket && connectionStatus === 'connected' && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(message));
        }
      },

      setAutoConnect: (enabled) => set({ autoConnect: enabled }),

      addTrustedServer: (server) => {
        set(state => {
          const exists = state.trustedServers.find(s => s.deviceId === server.deviceId);
          if (exists) {
            return {
              trustedServers: state.trustedServers.map(s =>
                s.deviceId === server.deviceId
                  ? { ...s, ip: server.ip, lastConnectedAt: Date.now() }
                  : s
              ),
              currentServer: { ...exists, ip: server.ip, lastConnectedAt: Date.now() }
            };
          }

          const newServer: TrustedServer = {
            ...server,
            autoConnect: true, // Default to true for new connections
            lastConnectedAt: Date.now()
          };

          return {
            trustedServers: [...state.trustedServers, newServer],
            currentServer: newServer
          };
        });
      },

      removeTrustedServer: (deviceId) => {
        set(state => ({
          trustedServers: state.trustedServers.filter(s => s.deviceId !== deviceId)
        }));
      },

      updateTrustedServer: (deviceId, updates) => {
        set(state => ({
          trustedServers: state.trustedServers.map(s =>
            s.deviceId === deviceId ? { ...s, ...updates } : s
          )
        }));
      },

      _handleMessage: (message) => {
        console.log('[P2P] Received:', message.type);
        set({
          lastReceivedMessage: {
            message,
            timestamp: Date.now()
          }
        });
      }
    }),
    {
      name: 'tizen-p2p-client',
      partialize: (state) => ({
        autoConnect: state.autoConnect,
        trustedServers: state.trustedServers
      })
    }
  )
);
