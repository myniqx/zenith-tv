import { useState } from 'react';
import { useP2PStore } from '../../stores/p2pStore';
import { Button } from '@zenith-tv/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@zenith-tv/ui/popover';
import { Monitor, Tv, Smartphone, Wifi, Settings2, RadioTower, ChevronDown } from 'lucide-react';
import { P2PSettingsDialog } from './P2PSettingsDialog';

export function P2PControl() {
  const {
    mode,
    connections,
    selectedDeviceId,
    selectDevice,
    connectionStatus
  } = useP2PStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (mode === 'off') {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="gap-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-none h-full px-4"
        >
          <RadioTower className="w-4 h-4" />
          P2P
        </Button>
        <P2PSettingsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  if (mode === 'client') {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className={`gap-2 hover:bg-white/10 rounded-none h-full px-4 ${connectionStatus === 'connected' ? 'text-success hover:text-success/80' : 'text-warning hover:text-warning/80'}`}
        >
          <Monitor className="w-4 h-4" />
          {connectionStatus === 'connected' ? 'Connected' : 'Connecting...'}
        </Button>
        <P2PSettingsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  const selectedConnection = connections.find(c => c.id === selectedDeviceId);
  const label = selectedConnection ? (selectedConnection.deviceName || selectedConnection.ip) : 'This Computer';
  const Icon = selectedDeviceId ? Tv : Wifi;

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-none h-full px-4"
          >
            <Icon className="w-4 h-4" />
            {label}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="end" sideOffset={8}>
          <button
            onClick={() => { selectDevice(null); setPopoverOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent ${!selectedDeviceId ? 'text-primary font-medium' : 'text-foreground'}`}
          >
            <Monitor className="w-4 h-4" />
            This Computer
          </button>

          {connections.map((conn) => (
            <button
              key={conn.id}
              onClick={() => { selectDevice(conn.id); setPopoverOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent ${selectedDeviceId === conn.id ? 'text-primary font-medium' : 'text-foreground'}`}
            >
              <Smartphone className="w-4 h-4" />
              {conn.deviceName || conn.ip}
            </button>
          ))}

          <div className="my-1 h-px bg-border/40" />

          <button
            onClick={() => { setPopoverOpen(false); setDialogOpen(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Settings2 className="w-4 h-4" />
            P2P Settings
          </button>
        </PopoverContent>
      </Popover>
      <P2PSettingsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
