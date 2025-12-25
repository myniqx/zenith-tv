import { P2PConnection, P2PMessage, P2PEventData } from '../../../../shared/content/src/types/p2p';

export const p2p = {
  start: (port?: number, deviceName?: string) => window.electron.p2p.start(port, deviceName),
  stop: () => window.electron.p2p.stop(),

  send: <T = unknown>(connectionId: string, message: P2PMessage<T>) =>
    window.electron.p2p.send(connectionId, message),

  broadcast: <T = unknown>(message: P2PMessage<T>) =>
    window.electron.p2p.broadcast(message),

  getDeviceInfo: () => window.electron.p2p.getDeviceInfo(),

  onConnection: (callback: (connection: P2PConnection) => void) => {
    window.electron.p2p.onConnection((data) => {
      callback({
        id: data.connectionId,
        ip: data.ip
      });
    });
  },

  onMessage: (callback: (data: P2PEventData) => void) => {
    window.electron.p2p.onMessage((data) => {
      callback({
        connectionId: data.connectionId,
        message: data.message as P2PMessage
      });
    });
  },

  onDisconnection: (callback: (connectionId: string) => void) => {
    window.electron.p2p.onDisconnection(callback);
  }
};
