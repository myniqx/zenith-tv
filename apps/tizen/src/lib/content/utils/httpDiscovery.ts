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

  async getLocalSubnets(): Promise<string[]> {
    // Electron environment
    // @ts-ignore - Electron types might not be available in shared
    if (typeof window !== 'undefined' && window.electron) {
      // @ts-ignore
      const ip: string = await window.electron.network.getLocalIP();
      return [ip.split('.').slice(0, 3).join('.')];
    }

    // Web/Tizen environment (WebRTC trick)
    return new Promise((resolve) => {
      const subnets = new Set<string>();
      let resolved = false;

      const done = () => {
        if (resolved) return;
        resolved = true;
        pc.close();
        resolve(subnets.size > 0 ? [...subnets] : ['192.168.1']);
      };

      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then((offer) => pc.setLocalDescription(offer));

      pc.onicecandidate = (ice) => {
        if (!ice.candidate) {
          // null candidate = gathering complete
          done();
          return;
        }
        const ipRegex = /([0-9]{1,3}\.){3}[0-9]{1,3}/;
        const match = ipRegex.exec(ice.candidate.candidate);
        if (match) {
          const ip = match[0];
          if (!ip.startsWith('127.') && !ip.startsWith('169.254.')) {
            subnets.add(ip.split('.').slice(0, 3).join('.'));
          }
        }
      };

      // Fallback timeout in case gathering never completes
      setTimeout(done, 3000);
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
      const subnets = await this.getLocalSubnets();

      console.log(`[Discovery] Scanning subnets: ${subnets.map(s => `${s}.0/24`).join(', ')}`);

      const promises: Promise<DiscoveredController | null>[] = [];

      for (const subnet of subnets) {
        for (let i = 1; i <= 254; i++) {
          promises.push(this.checkHost(`${subnet}.${i}`, 8080));
        }
      }

      const results = await Promise.all(promises);
      const seen = new Set<string>();
      const discovered = results.filter((r): r is DiscoveredController => {
        if (r === null || seen.has(r.deviceId)) return false;
        seen.add(r.deviceId);
        return true;
      });

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
