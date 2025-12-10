import { useState } from 'react';
import { useP2PStore } from '../../stores/p2pStore';
import { Button } from '@zenith-tv/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zenith-tv/ui/select';
import { Monitor, Tv, Smartphone, Wifi, Settings2, Power } from 'lucide-react';
import { P2PSettingsDialog } from '../P2P/P2PSettingsDialog';

export function P2PControl() {
  const {
    mode,
    connections,
    selectedDeviceId,
    selectDevice,
    connectionStatus
  } = useP2PStore();

  const [dialogOpen, setDialogOpen] = useState(false);

  // If P2P is off, show a simple button to open settings
  if (mode === 'off') {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => setDialogOpen(true)} title="Remote Control">
          <Power className="w-4 h-4 text-muted-foreground" />
        </Button>
        <P2PSettingsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  // If Client mode, show status
  if (mode === 'client') {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className={connectionStatus === 'connected' ? 'text-green-500' : 'text-yellow-500'}
        >
          <Monitor className="w-4 h-4 mr-2" />
          {connectionStatus === 'connected' ? 'Connected' : 'Connecting...'}
        </Button>
        <P2PSettingsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  // If Server mode, show Device Selector (similar to before but with settings trigger)
  const handleValueChange = (value: string) => {
    if (value === 'settings') {
      setDialogOpen(true);
    } else if (value === 'local') {
      selectDevice(null);
    } else {
      selectDevice(value);
    }
  };

  return (
    <>
      <Select
        value={selectedDeviceId || 'local'}
        onValueChange={handleValueChange}
      >
        <SelectTrigger className="w-[180px] h-9 gap-2">
          {selectedDeviceId ? <Tv className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
          <SelectValue placeholder="Select Device" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="local">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              <span>This Computer</span>
            </div>
          </SelectItem>

          {connections.map((conn) => (
            <SelectItem key={conn.id} value={conn.id}>
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                <span>{conn.deviceName || conn.ip}</span>
              </div>
            </SelectItem>
          ))}

          <div className="px-2 py-1.5 border-t mt-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-auto p-0 font-normal"
              onClick={(e) => {
                e.stopPropagation();
                setDialogOpen(true);
              }}
            >
              <Settings2 className="w-3 h-3 mr-2" />
              P2P Settings
            </Button>
          </div>
        </SelectContent>
      </Select>
      <P2PSettingsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
