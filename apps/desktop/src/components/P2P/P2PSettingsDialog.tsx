import { useState, useEffect, useMemo } from 'react';
import { useP2PStore } from '../../stores/p2pStore';
import { Button } from '@zenith-tv/ui/button';
import { Input } from '@zenith-tv/ui/input';
import { Label } from '@zenith-tv/ui/label';
import { Switch } from '@zenith-tv/ui/switch';
import { Badge } from '@zenith-tv/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@zenith-tv/ui/dialog';
import { Wifi, Monitor, Power, RefreshCw, Loader2, ChevronDown } from 'lucide-react';

interface P2PSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function P2PSettingsDialog({ open, onOpenChange }: P2PSettingsDialogProps) {
  const {
    mode,
    setMode,
    startServer,
    stopServer,
    connectToServer,
    disconnectClient,
    connectionStatus,
    discoveredServers,
    isScanning,
    startScanning,
    stopScanning,
    connectToDiscoveredServer,
    deviceName,
    setDeviceName,
    serverPort: storePort,
    setServerPort: updateStorePort,
    autoConnect,
    setAutoConnect,
    trustedServers,
    connections,
    serverUrl,
  } = useP2PStore();

  const [serverPort, setServerPort] = useState(storePort.toString());
  const [clientIp, setClientIp] = useState('');
  const [clientPort, setClientPort] = useState('8080');
  const [showManualConnection, setShowManualConnection] = useState(false);

  // Validation functions
  const validateIP = (ip: string): boolean => {
    if (!ip) return false;
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;

    const parts = ip.split('.');
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  };

  const validatePort = (port: string): boolean => {
    const portNum = parseInt(port, 10);
    return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
  };

  // Check if manual connection is valid
  const isManualConnectionValid = useMemo(() => {
    return validateIP(clientIp) && validatePort(clientPort);
  }, [clientIp, clientPort]);

  // Check if server port is valid
  const isServerPortValid = useMemo(() => {
    return validatePort(serverPort);
  }, [serverPort]);

  // Sort discovered servers (trusted first)
  const sortedServers = useMemo(() => {
    return [...discoveredServers].sort((a, b) => {
      const aTrusted = trustedServers.some((ts) => ts.deviceId === a.deviceId);
      const bTrusted = trustedServers.some((ts) => ts.deviceId === b.deviceId);
      if (aTrusted && !bTrusted) return -1;
      if (!aTrusted && bTrusted) return 1;
      return a.deviceName.localeCompare(b.deviceName);
    });
  }, [discoveredServers, trustedServers]);

  // Auto-start scanning when entering client mode
  useEffect(() => {
    if (mode === 'client' && open) {
      startScanning();
    }
    return () => {
      if (mode === 'client') {
        stopScanning();
      }
    };
  }, [mode, open, startScanning, stopScanning]);

  const handleModeChange = (value: string) => {
    setMode(value as 'off' | 'server' | 'client');
  };

  const handleServerPortChange = (value: string) => {
    setServerPort(value);
    const portNum = parseInt(value, 10);
    if (!isNaN(portNum) && portNum > 0 && portNum <= 65535) {
      updateStorePort(portNum);
    }
  };

  const handleStartServer = () => {
    if (!isServerPortValid) return;
    startServer(parseInt(serverPort, 10));
  };

  const handleStopServer = () => {
    stopServer();
  };

  const handleConnect = () => {
    if (!isManualConnectionValid) return;
    connectToServer(clientIp, parseInt(clientPort, 10));
  };

  const handleDisconnect = () => {
    disconnectClient();
  };

  // Get status text for dialog description
  const getStatusText = () => {
    if (mode === 'off') return 'Status: Disabled';
    if (mode === 'server') {
      return connectionStatus === 'connected' ? 'Status: Running' : 'Status: Stopped';
    }
    if (mode === 'client') {
      return `Status: ${connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}`;
    }
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Remote Control Settings</DialogTitle>
          <DialogDescription>{getStatusText()}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[200px_1fr] gap-4 py-4">
          {/* Left Column - Mode Selection */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm text-muted-foreground mb-1">Operation Mode</Label>
            <div
              className={`cursor-pointer flex items-center gap-3 rounded-md border-2 p-3 hover:bg-accent hover:text-accent-foreground transition-colors ${mode === 'off' ? 'border-primary bg-accent text-accent-foreground' : 'border-muted bg-popover'}`}
              onClick={() => handleModeChange('off')}
            >
              <Power className="h-5 w-5" />
              <span className="font-medium">Off</span>
            </div>
            <div
              className={`cursor-pointer flex items-center gap-3 rounded-md border-2 p-3 hover:bg-accent hover:text-accent-foreground transition-colors ${mode === 'server' ? 'border-primary bg-accent text-accent-foreground' : 'border-muted bg-popover'}`}
              onClick={() => handleModeChange('server')}
            >
              <Wifi className="h-5 w-5" />
              <span className="font-medium">Server</span>
            </div>
            <div
              className={`cursor-pointer flex items-center gap-3 rounded-md border-2 p-3 hover:bg-accent hover:text-accent-foreground transition-colors ${mode === 'client' ? 'border-primary bg-accent text-accent-foreground' : 'border-muted bg-popover'}`}
              onClick={() => handleModeChange('client')}
            >
              <Monitor className="h-5 w-5" />
              <span className="font-medium">Client</span>
            </div>
          </div>

          {/* Right Column - Mode Settings/Description */}
          <div className="min-h-[300px]">{mode === 'off' && (
            <div className="flex items-center justify-center h-full text-center text-muted-foreground">
              <div className="space-y-2">
                <Power className="h-12 w-12 mx-auto opacity-50" />
                <p className="text-sm">Remote control is disabled</p>
                <p className="text-xs">
                  Select Server mode to control other devices, or Client mode to be controlled by
                  another device.
                </p>
              </div>
            </div>
          )}

            {/* Server Settings */}
            {mode === 'server' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Controller Settings</Label>
                  {connectionStatus === 'connected' ? (
                    <Button variant="destructive" size="sm" onClick={handleStopServer}>
                      Stop Server
                    </Button>
                  ) : (
                    <Button size="sm" onClick={handleStartServer} disabled={!isServerPortValid}>
                      Start Server
                    </Button>
                  )}
                </div>

                {/* Device Name Input */}
                <div className="space-y-2">
                  <Label>Device Name</Label>
                  <Input
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="My Computer (Zenith TV)"
                    disabled={connectionStatus === 'connected'}
                  />
                  <p className="text-xs text-muted-foreground">
                    This name will be visible to devices connecting to you
                  </p>
                </div>

                {/* Port Input */}
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    value={serverPort}
                    onChange={(e) => handleServerPortChange(e.target.value)}
                    placeholder="8080"
                    disabled={connectionStatus === 'connected'}
                    className={!isServerPortValid && serverPort ? 'border-red-500' : ''}
                  />
                  {!isServerPortValid && serverPort && (
                    <p className="text-xs text-red-500">Port must be between 1 and 65535</p>
                  )}
                </div>

                {/* Active Connections */}
                {connectionStatus === 'connected' && connections.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">Connected Devices ({connections.length})</Label>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {connections.map((conn) => (
                        <div
                          key={conn.id}
                          className="flex items-center justify-between p-2 border rounded bg-muted/30 text-sm"
                        >
                          <span className="truncate">{conn.deviceName || conn.ip}</span>
                          <Badge variant="outline" className="text-xs shrink-0 ml-2">
                            Connected
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Client Settings */}
            {mode === 'client' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Client Settings</Label>
                  {connectionStatus === 'connected' && (
                    <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                      Disconnect
                    </Button>
                  )}
                </div>

                {/* Connected Server Info */}
                {connectionStatus === 'connected' && serverUrl && (
                  <div className="p-3 border rounded-md bg-blue-500/10 border-blue-500/20">
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      Connected to Controller
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {serverUrl.replace('ws://', '')}
                    </div>
                  </div>
                )}

                {/* Auto-Connect Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Connect</Label>
                    <div className="text-xs text-muted-foreground">
                      Connect to trusted controllers automatically
                    </div>
                  </div>
                  <Switch checked={autoConnect} onCheckedChange={setAutoConnect} />
                </div>

                {/* Discovered Controllers */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Available Controllers</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={isScanning ? stopScanning : startScanning}
                      disabled={connectionStatus === 'connected'}
                    >
                      {isScanning ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Scanning
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Scan
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Server List */}
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {sortedServers.map((server) => {
                      const isTrusted = trustedServers.some((ts) => ts.deviceId === server.deviceId);
                      return (
                        <div
                          key={server.deviceId}
                          className="flex items-center justify-between p-2 border rounded-md bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{server.deviceName}</span>
                              {isTrusted && (
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  Trusted
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {server.ip}:{server.port}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => connectToDiscoveredServer(server.deviceId)}
                            disabled={connectionStatus === 'connected' || connectionStatus === 'connecting'}
                          >
                            Connect
                          </Button>
                        </div>
                      );
                    })}

                    {sortedServers.length === 0 && !isScanning && (
                      <div className="text-center text-sm text-muted-foreground py-6 border rounded-md bg-muted/20">
                        <Wifi className="w-6 h-6 mx-auto mb-2 opacity-50" />
                        <div className="text-xs">No controllers found</div>
                      </div>
                    )}

                    {isScanning && sortedServers.length === 0 && (
                      <div className="text-center text-sm text-muted-foreground py-6 border rounded-md bg-muted/20">
                        <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
                        <div className="text-xs">Searching...</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Manual Connection */}
                <div className="space-y-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setShowManualConnection(!showManualConnection)}
                    className="flex items-center justify-between w-full text-sm text-foreground hover:text-accent-foreground transition-colors"
                    disabled={connectionStatus === 'connected'}
                  >
                    <Label className="cursor-pointer">Manual Connection</Label>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${showManualConnection ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {showManualConnection && (
                    <div className="space-y-2 animate-in slide-in-from-top-2">
                      <div className="grid grid-cols-[1fr_100px] gap-2">
                        <div className="space-y-1">
                          <Input
                            value={clientIp}
                            onChange={(e) => setClientIp(e.target.value)}
                            placeholder="192.168.1.x"
                            disabled={connectionStatus === 'connected'}
                            className={!validateIP(clientIp) && clientIp ? 'border-red-500' : ''}
                          />
                          {!validateIP(clientIp) && clientIp && (
                            <p className="text-xs text-red-500">Invalid IP</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Input
                            value={clientPort}
                            onChange={(e) => setClientPort(e.target.value)}
                            placeholder="8080"
                            disabled={connectionStatus === 'connected'}
                            className={!validatePort(clientPort) && clientPort ? 'border-red-500' : ''}
                          />
                          {!validatePort(clientPort) && clientPort && (
                            <p className="text-xs text-red-500">Invalid</p>
                          )}
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        size="sm"
                        onClick={handleConnect}
                        disabled={
                          connectionStatus === 'connected' ||
                          connectionStatus === 'connecting' ||
                          !isManualConnectionValid
                        }
                      >
                        {connectionStatus === 'connecting' ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          'Connect'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
