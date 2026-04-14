import { useState } from 'react';
import { useP2PClientStore } from '../../stores/p2pClientStore';
import { FocusButton, FocusInput } from '../Navigation';
import { FocusScope } from '../../contexts/FocusScope';
import { Card, CardContent } from '@zenith-tv/ui/card';
import { Badge } from '@zenith-tv/ui/badge';
import { Separator } from '@zenith-tv/ui/separator';
import { RefreshCw } from 'lucide-react';

export function P2PView() {
  const {
    connectionStatus,
    currentServer,
    trustedServers,
    discoveredServers,
    isScanning,
    scan,
    connect,
    disconnect,
    updateTrustedServer,
    removeTrustedServer
  } = useP2PClientStore();

  const [manualIp, setManualIp] = useState('');

  const allServers = [
    ...trustedServers,
    ...discoveredServers.filter(d => !trustedServers.find(t => t.deviceId === d.deviceId))
  ];

  return (
    <div className="h-full bg-background text-foreground overflow-y-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">P2P Uzaktan Kontrol</h1>

      {/* Status Bar */}
      <Card className="mb-6">
        <CardContent className="p-4 flex items-center gap-4">
          <span className={`w-3 h-3 rounded-full shrink-0 ${
            connectionStatus === 'connected' ? 'bg-green-500' :
            connectionStatus === 'connecting' ? 'bg-yellow-500' :
            'bg-destructive'
          }`} />
          <span className="text-base font-medium">
            {connectionStatus === 'connected' && currentServer
              ? `Bağlı: ${currentServer.deviceName} (${currentServer.ip})`
              : connectionStatus === 'connecting'
                ? 'Bağlanıyor...'
                : 'Bağlı Değil'}
          </span>
          {connectionStatus === 'connected' && (
            <FocusButton
              focusId="disconnect-btn"
              onClick={disconnect}
              variant="destructive"
              size="sm"
              className="ml-auto"
            >
              Bağlantıyı Kes
            </FocusButton>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-6 flex-1">

        {/* Manuel Bağlantı */}
        <Card className="w-1/3 h-fit">
          <CardContent className="p-6">
            <h2 className="text-base font-semibold mb-4">Manuel Bağlantı</h2>
            <FocusScope id="p2p-manual-connect">
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">IP Adresi</label>
                  <FocusInput
                    focusId="manual-ip-input"
                    type="text"
                    value={manualIp}
                    onChange={(e) => setManualIp(e.target.value)}
                    onEnter={() => connect({ ip: manualIp, port: 8080, deviceId: 'manual', deviceName: 'Manual Server', version: '1.0' })}
                    placeholder="192.168.1.X"
                    className="w-full"
                  />
                </div>
                <FocusButton
                  focusId="manual-connect-btn"
                  onClick={() => connect({ ip: manualIp, port: 8080, deviceId: 'manual', deviceName: 'Manual Server', version: '1.0' })}
                  className="w-full"
                >
                  Bağlan
                </FocusButton>
              </div>
            </FocusScope>
          </CardContent>
        </Card>

        {/* Cihaz Listesi */}
        <Card className="flex-1">
          <CardContent className="p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Bulunan Cihazlar</h2>
              <FocusButton
                focusId="scan-btn"
                onClick={() => scan()}
                variant="secondary"
                size="sm"
                disabled={isScanning}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning ? 'Aranıyor...' : 'Tekrar Tara'}
              </FocusButton>
            </div>

            <Separator className="mb-4" />

            <div className="space-y-3">
              {allServers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">
                  Hiçbir cihaz bulunamadı. Desktop uygulamasının açık olduğundan emin olun.
                </p>
              ) : (
                allServers.map((server) => {
                  const isTrusted = trustedServers.some(t => t.deviceId === server.deviceId);
                  const trustedData = trustedServers.find(t => t.deviceId === server.deviceId);
                  const isConnected = currentServer?.deviceId === server.deviceId && connectionStatus === 'connected';

                  return (
                    <div
                      key={server.deviceId}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                        isConnected ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isConnected && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
                        <div>
                          <p className="font-medium text-foreground">{server.deviceName}</p>
                          <p className="text-sm text-muted-foreground">{server.ip}:{server.port}</p>
                        </div>
                        {isTrusted && (
                          <Badge variant="secondary" className="text-xs">Kaydedildi</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isTrusted && (
                          <FocusButton
                            focusId={`autoconnect-${server.deviceId}`}
                            onClick={() => updateTrustedServer(server.deviceId, { autoConnect: !trustedData?.autoConnect })}
                            variant={trustedData?.autoConnect ? 'default' : 'secondary'}
                            size="sm"
                            focusStyle="highlight"
                          >
                            Otomatik: {trustedData?.autoConnect ? 'Açık' : 'Kapalı'}
                          </FocusButton>
                        )}
                        <FocusButton
                          focusId={`connect-${server.deviceId}`}
                          onClick={() => connect(server)}
                          size="sm"
                          focusStyle="highlight"
                        >
                          Bağlan
                        </FocusButton>
                        {isTrusted && (
                          <FocusButton
                            focusId={`forget-${server.deviceId}`}
                            onClick={() => removeTrustedServer(server.deviceId)}
                            variant="ghost"
                            size="icon"
                            focusStyle="highlight"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            ✕
                          </FocusButton>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
