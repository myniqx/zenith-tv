import { useState } from 'react';
import { useP2PClientStore } from '../../stores/p2pClientStore';
import { FocusButton, FocusInput } from '../Navigation';
import { FocusScope } from '../../contexts/FocusScope';

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

  // Combine discovered and trusted servers for the list
  // We want to show:
  // 1. Currently connected server (highlighted)
  // 2. Trusted servers (even if not discovered right now)
  // 3. Discovered servers (that are not already in trusted list)

  const allServers = [
    ...trustedServers,
    ...discoveredServers.filter(d => !trustedServers.find(t => t.deviceId === d.deviceId))
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8 text-red-500">P2P Uzaktan Kontrol</h1>

      {/* Status Bar */}
      <div className="flex items-center gap-4 mb-8 bg-slate-800 p-4 rounded-lg">
        <div className={`w-4 h-4 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' :
          connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
          }`} />
        <span className="text-xl font-medium">
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
            className="ml-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            Bağlantıyı Kes
          </FocusButton>
        )}
      </div>

      <div className="flex gap-8 flex-1">

        {/* Manual Connect Panel */}
        <div className="w-1/3 bg-slate-800 p-6 rounded-lg h-fit">
          <h2 className="text-xl font-bold mb-4">Manuel Bağlantı</h2>
          <FocusScope id="p2p-manual-connect">
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">IP Adresi</label>
                <FocusInput
                  focusId="manual-ip-input"
                  type="text"
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  onEnter={() => connect({ ip: manualIp, port: 8080, deviceId: 'manual', deviceName: 'Manual Server', version: '1.0' })}
                  placeholder="192.168.1.X"
                  className="w-full bg-slate-700 text-white p-3 rounded"
                />
              </div>
              <FocusButton
                focusId="manual-connect-btn"
                onClick={() => connect({ ip: manualIp, port: 8080, deviceId: 'manual', deviceName: 'Manual Server', version: '1.0' })}
                className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded w-full justify-center"
              >
                Bağlan
              </FocusButton>
            </div>
          </FocusScope>
        </div>

        {/* Server List Panel */}
        <div className="w-2/3 bg-slate-800 p-6 rounded-lg flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Bulunan Cihazlar</h2>
            <FocusButton
              focusId="scan-btn"
              onClick={() => scan()}
              className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded flex items-center gap-2"
              variant={isScanning ? 'ghost' : 'secondary'}
            >
              {isScanning ? (
                <>
                  <span className="animate-spin">↻</span> Aranıyor...
                </>
              ) : (
                'Tekrar Tara'
              )}
            </FocusButton>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {allServers.length === 0 ? (
              <div className="text-slate-500 text-center py-10">
                Hiçbir cihaz bulunamadı. Lütfen Desktop uygulamasının açık olduğundan emin olun.
              </div>
            ) : (
              allServers.map((server) => {
                const isTrusted = trustedServers.some(t => t.deviceId === server.deviceId);
                const trustedData = trustedServers.find(t => t.deviceId === server.deviceId);

                return (
                  <div key={server.deviceId} className="bg-slate-700 p-4 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-bold text-lg">{server.deviceName}</div>
                      <div className="text-slate-400 text-sm">{server.ip}:{server.port}</div>
                      {isTrusted && <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded mt-1 inline-block">Kaydedildi</span>}
                    </div>

                    <div className="flex items-center gap-3">
                      {isTrusted && (
                        <FocusButton
                          focusId={`autoconnect-${server.deviceId}`}
                          onClick={() => updateTrustedServer(server.deviceId, { autoConnect: !trustedData?.autoConnect })}
                          className={`text-sm px-3 py-2 rounded ${trustedData?.autoConnect ? 'bg-blue-900 text-blue-300' : 'bg-slate-600 text-slate-300'}`}
                        >
                          Otomatik: {trustedData?.autoConnect ? 'Açık' : 'Kapalı'}
                        </FocusButton>
                      )}

                      <FocusButton
                        focusId={`connect-${server.deviceId}`}
                        onClick={() => connect(server)}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
                      >
                        Bağlan
                      </FocusButton>

                      {isTrusted && (
                        <FocusButton
                          focusId={`forget-${server.deviceId}`}
                          onClick={() => removeTrustedServer(server.deviceId)}
                          className="bg-slate-600 hover:bg-red-900 text-white px-3 py-2 rounded"
                        >
                          X
                        </FocusButton>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
