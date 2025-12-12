import { ipcMain } from 'electron';
import os from 'os';

export function registerNetworkHandlers(): void {
  ipcMain.handle('network:getLocalIP', async () => {
    const interfaces = os.networkInterfaces();

    for (const devName in interfaces) {
      const iface = interfaces[devName];
      if (!iface) continue;

      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          return alias.address;
        }
      }
    }

    return '127.0.0.1';
  });
}
