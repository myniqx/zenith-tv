import { useState } from 'react';
import { useP2PStore } from '../../stores/p2pStore';
import { Button } from '@zenith-tv/ui/button';
import { Input } from '@zenith-tv/ui/input';
import { Label } from '@zenith-tv/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@zenith-tv/ui/dialog';
import { Wifi, Monitor, Power, RefreshCw } from 'lucide-react';

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
    deviceInfo
  } = useP2PStore();

  const [serverPort, setServerPort] = useState('8080');
  const [clientIp, setClientIp] = useState('');
  const [clientPort, setClientPort] = useState('8080');

  const handleModeChange = (value: string) => {
    setMode(value as 'off' | 'server' | 'client');
  };

  const handleStartServer = () => {
    startServer(parseInt(serverPort, 10));
  };

  const handleStopServer = () => {
    stopServer();
  };

  const handleConnect = () => {
    connectToServer(clientIp, parseInt(clientPort, 10));
  };

  const handleDisconnect = () => {
    disconnectClient();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Remote Control Settings</DialogTitle>
          <DialogDescription>
            Configure this device as a controller (Server) or controlled device (Client).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Mode Selection */}
          <div className="flex flex-col gap-3">
            <Label>Operation Mode</Label>
            <div className="grid grid-cols-3 gap-4">
              <div
                className={`cursor-pointer flex flex-col items-center justify-between rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground ${mode === 'off' ? 'border-primary bg-accent text-accent-foreground' : 'border-muted bg-popover'}`}
                onClick={() => handleModeChange('off')}
              >
                <Power className="mb-3 h-6 w-6" />
                Off
              </div>
              <div
                className={`cursor-pointer flex flex-col items-center justify-between rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground ${mode === 'server' ? 'border-primary bg-accent text-accent-foreground' : 'border-muted bg-popover'}`}
                onClick={() => handleModeChange('server')}
              >
                <Wifi className="mb-3 h-6 w-6" />
                Server
              </div>
              <div
                className={`cursor-pointer flex flex-col items-center justify-between rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground ${mode === 'client' ? 'border-primary bg-accent text-accent-foreground' : 'border-muted bg-popover'}`}
                onClick={() => handleModeChange('client')}
              >
                <Monitor className="mb-3 h-6 w-6" />
                Client
              </div>
            </div>
          </div>

          {/* Server Settings */}
          {mode === 'server' && (
            <div className="space-y-4 border rounded-md p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Server Status</Label>
                  <div className="text-sm text-muted-foreground">
                    {connectionStatus === 'connected' ? 'Running' : 'Stopped'}
                  </div>
                </div>
                {connectionStatus === 'connected' ? (
                  <Button variant="destructive" size="sm" onClick={handleStopServer}>Stop</Button>
                ) : (
                  <Button size="sm" onClick={handleStartServer}>Start</Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    value={serverPort}
                    onChange={(e) => setServerPort(e.target.value)}
                    disabled={connectionStatus === 'connected'}
                  />
                </div>
              </div>

              {deviceInfo && (
                <div className="text-xs text-muted-foreground mt-2">
                  Device Name: {deviceInfo.name} <br />
                  Device ID: {deviceInfo.id}
                </div>
              )}
            </div>
          )}

          {/* Client Settings */}
          {mode === 'client' && (
            <div className="space-y-4 border rounded-md p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Connection Status</Label>
                  <div className="text-sm text-muted-foreground capitalize">
                    {connectionStatus}
                  </div>
                </div>
                {connectionStatus === 'connected' ? (
                  <Button variant="destructive" size="sm" onClick={handleDisconnect}>Disconnect</Button>
                ) : (
                  <Button size="sm" onClick={handleConnect} disabled={connectionStatus === 'connecting'}>
                    {connectionStatus === 'connecting' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Connect'}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Server IP</Label>
                  <Input
                    value={clientIp}
                    onChange={(e) => setClientIp(e.target.value)}
                    placeholder="192.168.1.x"
                    disabled={connectionStatus === 'connected'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    value={clientPort}
                    onChange={(e) => setClientPort(e.target.value)}
                    disabled={connectionStatus === 'connected'}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
