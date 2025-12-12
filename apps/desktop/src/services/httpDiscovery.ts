export interface DiscoveredController {
  deviceId: string;
  deviceName: string;
  ip: string;
  port: number;
  version: string;
}

export class HTTPDiscoveryService {
  private isScanning = false;
  private abortController: AbortController | null = null;

  async getLocalIP(): Promise<string> {
    // Electron environment
    if (typeof window.electron !== 'undefined') {
      return window.electron.network.getLocalIP();
    }

    // Web/Tizen environment (WebRTC trick)
    return new Promise((resolve) => {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then((offer) => pc.setLocalDescription(offer));

      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate) return;
        const ipRegex = /([0-9]{1,3}\.){3}[0-9]{1,3}/;
        const match = ipRegex.exec(ice.candidate.candidate);
        if (match) {
          resolve(match[0]);
          pc.close();
        }
      };

      // Fallback timeout
      setTimeout(() => {
        pc.close();
        resolve('127.0.0.1');
      }, 3000);
    });
  }

  async scan(): Promise<DiscoveredController[]> {
    if (this.isScanning) {
      console.warn('[Discovery] Scan already in progress');
      return [];
    }

    this.isScanning = true;
    this.abortController = new AbortController();

    try {
      const localIP = await this.getLocalIP();
      const subnet = localIP.split('.').slice(0, 3).join('.');

      console.log(`[Discovery] Scanning subnet ${subnet}.0/24`);

      const promises: Promise<DiscoveredController | null>[] = [];

      // Scan 254 IP addresses in parallel
      for (let i = 1; i <= 254; i++) {
        const ip = `${subnet}.${i}`;
        promises.push(this.checkHost(ip, 8080));
      }

      const results = await Promise.all(promises);
      const discovered = results.filter((r): r is DiscoveredController => r !== null);

      console.log(`[Discovery] Found ${discovered.length} controller(s)`);
      return discovered;
    } finally {
      this.isScanning = false;
      this.abortController = null;
    }
  }

  private async checkHost(ip: string, port: number): Promise<DiscoveredController | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300);

      const response = await fetch(`http://${ip}:${port}/api/discover`, {
        signal: controller.signal,
        mode: 'cors',
        headers: { Accept: 'application/json' },
      });

      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const data = await response.json();

      // Only accept controllers
      if (data.role !== 'controller') return null;

      return {
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        ip,
        port: data.port || port,
        version: data.version || '1.0.0',
      };
    } catch (error) {
      // Timeout or connection refused - normal during scan
      return null;
    }
  }

  stopScan(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isScanning = false;
  }
}

export const httpDiscovery = new HTTPDiscoveryService();
