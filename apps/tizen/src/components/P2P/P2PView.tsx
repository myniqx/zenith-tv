import { useState } from 'react';
import { useP2PClientStore } from '../../stores/p2pClientStore';
import { Button, VerticalList, HorizontalList, Input } from '@navix/react';
import { RefreshCw, Wifi, WifiOff, X } from 'lucide-react';
import { cn } from '@zenith-tv/ui/lib';

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
    ...discoveredServers.filter(d => !trustedServers.find(t => t.deviceId === d.deviceId)),
    ...Array(3).fill(null).map((_, i) => ({ deviceId: `placeholder-${i}`, deviceName: 'Cihaz Adı', ip: '192.168.1.X', port: 8080, version: '1.0' }))
  ];

  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';

  return (
    <div className="flex-1 min-h-0 bg-background text-foreground overflow-y-auto">
      <div className="max-w-5xl mx-auto px-12 py-10">

        {/* Page Header */}
        <h1 className="font-headline text-3xl font-black tracking-tight text-foreground mb-1">
          P2P Uzaktan Kontrol
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Desktop uygulamasına bağlanarak uzaktan kontrol sağlayın
        </p>

        <VerticalList fKey="p2p">

          {/* Connection Status Banner */}
          <section className="mb-8">
            <div className={cn(
              'flex items-center justify-between px-6 py-5 rounded-xl transition-colors duration-200',
              isConnected ? 'bg-primary/10' : 'bg-secondary',
            )}>
              <div className="flex items-center gap-4">
                <div className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full shrink-0',
                  isConnected ? 'bg-primary/20' : 'bg-muted',
                )}>
                  {isConnected
                    ? <Wifi size={18} className="text-primary" />
                    : <WifiOff size={18} className="text-muted-foreground" />
                  }
                </div>
                <div>
                  <p className={cn(
                    'text-base font-semibold',
                    isConnected ? 'text-primary' : 'text-foreground/80',
                  )}>
                    {isConnected && currentServer
                      ? currentServer.deviceName
                      : isConnecting
                        ? 'Bağlanıyor...'
                        : 'Bağlı Değil'}
                  </p>
                  {isConnected && currentServer && (
                    <p className="text-sm text-muted-foreground">{currentServer.ip}:{currentServer.port}</p>
                  )}
                </div>
              </div>

              {isConnected && (
                <Button fKey="disconnect-btn" onClick={disconnect}>
                  {({ focused }) => (
                    <span className={cn(
                      'flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold transition-all duration-200',
                      focused
                        ? 'bg-destructive text-destructive-foreground scale-100'
                        : 'bg-muted text-muted-foreground scale-95',
                    )}>
                      Bağlantıyı Kes
                    </span>
                  )}
                </Button>
              )}
            </div>
          </section>

          <HorizontalList className="flex gap-8 items-start">

            {/* Manuel Bağlantı */}
            <VerticalList fKey="p2p-manual" className="w-72 shrink-0">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Manuel Bağlantı
              </h2>
              <div className="bg-secondary rounded-xl overflow-hidden px-6 py-5">
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      IP Adresi
                    </label>
                    <Input
                      value={manualIp}
                      onChange={(e) => setManualIp(e)}
                      placeholder="192.168.1.X"
                      className="w-full px-4 py-3 rounded-lg bg-muted text-foreground text-sm placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <Button
                    fKey="manual-connect-btn"
                    onClick={() => connect({ ip: manualIp, port: 8080, deviceId: 'manual', deviceName: 'Manual Server', version: '1.0' })}
                  >
                    {({ focused }) => (
                      <span className={cn(
                        'block w-full text-center px-4 py-3 rounded-lg text-sm font-bold transition-all duration-200',
                        focused
                          ? 'bg-primary text-primary-foreground scale-100'
                          : 'bg-primary/80 text-primary-foreground scale-95',
                      )}>
                        Bağlan
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </VerticalList>

            {/* Cihaz Listesi */}
            <VerticalList fKey="p2p-servers" className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Bulunan Cihazlar
                </h2>
                <Button fKey="scan-btn" onClick={() => scan()}>
                  {({ focused }) => (
                    <span className={cn(
                      'flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200',
                      focused ? 'bg-accent text-foreground scale-100' : 'text-muted-foreground scale-95',
                    )}>
                      <RefreshCw className={cn('w-3.5 h-3.5', isScanning && 'animate-spin')} />
                      {isScanning ? 'Aranıyor...' : 'Tekrar Tara'}
                    </span>
                  )}
                </Button>
              </div>

              <div className="bg-secondary rounded-xl overflow-hidden">
                {allServers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-8">
                    <WifiOff size={32} className="text-muted-foreground/40 mb-4" />
                    <p className="text-sm text-muted-foreground text-center">
                      Hiçbir cihaz bulunamadı.
                    </p>
                    <p className="text-xs text-muted-foreground/60 text-center mt-1">
                      Desktop uygulamasının açık olduğundan emin olun.
                    </p>
                  </div>
                ) : (
                  <div className="px-4 py-2">
                    {allServers.map((server, index) => {
                      const isTrusted = trustedServers.some(t => t.deviceId === server.deviceId);
                      const trustedData = trustedServers.find(t => t.deviceId === server.deviceId);
                      const isThisConnected = currentServer?.deviceId === server.deviceId && isConnected;

                      return (
                        <div key={server.deviceId}>
                          {index > 0 && <div className="h-px bg-border/20 mx-2" />}
                          <div className={cn(
                            'flex items-center justify-between px-4 py-4 rounded-lg transition-colors duration-200',
                            isThisConnected && 'bg-primary/5',
                          )}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn(
                                'w-2 h-2 rounded-full shrink-0',
                                isThisConnected ? 'bg-primary' : 'bg-muted-foreground/30',
                              )} />
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground truncate">{server.deviceName}</p>
                                <p className="text-sm text-muted-foreground">{server.ip}:{server.port}</p>
                              </div>
                              {isTrusted && (
                                <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-bold uppercase tracking-widest">
                                  Kayıtlı
                                </span>
                              )}
                            </div>

                            <HorizontalList fKey={`server-actions-${server.deviceId}`}>
                              <div className="flex items-center gap-2 shrink-0">
                                {isTrusted && (
                                  <Button
                                    fKey={`autoconnect-${server.deviceId}`}
                                    onClick={() => updateTrustedServer(server.deviceId, { autoConnect: !trustedData?.autoConnect })}
                                  >
                                    {({ focused }) => (
                                      <span className={cn(
                                        'px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200',
                                        trustedData?.autoConnect
                                          ? focused ? 'bg-primary text-primary-foreground scale-100' : 'bg-primary/80 text-primary-foreground scale-95'
                                          : focused ? 'bg-accent text-foreground scale-100' : 'bg-muted text-muted-foreground scale-95',
                                      )}>
                                        Otomatik: {trustedData?.autoConnect ? 'Açık' : 'Kapalı'}
                                      </span>
                                    )}
                                  </Button>
                                )}
                                <Button
                                  fKey={`connect-${server.deviceId}`}
                                  onClick={() => connect(server)}
                                >
                                  {({ focused }) => (
                                    <span className={cn(
                                      'px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200',
                                      focused
                                        ? 'bg-primary text-primary-foreground scale-100'
                                        : 'bg-secondary text-muted-foreground ring-1 ring-border/30 scale-95',
                                    )}>
                                      Bağlan
                                    </span>
                                  )}
                                </Button>
                                {isTrusted && (
                                  <Button
                                    fKey={`forget-${server.deviceId}`}
                                    onClick={() => removeTrustedServer(server.deviceId)}
                                  >
                                    {({ focused }) => (
                                      <span className={cn(
                                        'flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200',
                                        focused
                                          ? 'bg-destructive/20 text-destructive scale-100'
                                          : 'text-muted-foreground/50 scale-95',
                                      )}>
                                        <X size={14} />
                                      </span>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </HorizontalList>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </VerticalList>
          </HorizontalList>
        </VerticalList>
      </div>
    </div>
  );
}
