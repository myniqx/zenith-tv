import { useState } from 'react';
import { useP2PStore } from '@/stores/p2pStore';
import { Button } from '@zenith-tv/ui/button';
import { Switch } from '@zenith-tv/ui/switch';
import { Label } from '@zenith-tv/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@zenith-tv/ui/dialog';

export function PairingRequestDialog() {
  const { pairingRequest, acceptPairing, rejectPairing, addTrustedServer } = useP2PStore();

  const [rememberDevice, setRememberDevice] = useState(true);
  const [autoConnect, setAutoConnect] = useState(false);

  const handleAccept = async () => {
    if (!pairingRequest) return;

    await acceptPairing();

    // Add to trusted servers if remember is checked
    if (rememberDevice) {
      addTrustedServer({
        deviceId: pairingRequest.deviceId,
        deviceName: pairingRequest.deviceName,
        lastIp: '', // We don't have IP in pairing request, will be updated on next discovery
        lastPort: 8080,
        autoConnect: autoConnect,
        pairedAt: Date.now(),
      });
    }

    // Reset checkboxes for next pairing
    setRememberDevice(true);
    setAutoConnect(false);
  };

  const handleReject = async () => {
    await rejectPairing();
    setRememberDevice(true);
    setAutoConnect(false);
  };

  if (!pairingRequest) return null;

  return (
    <Dialog open={!!pairingRequest} onOpenChange={(open) => !open && handleReject()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Pairing Request</DialogTitle>
          <DialogDescription>A device wants to connect to this controller</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md border bg-muted/50 p-4">
            <div className="font-medium">{pairingRequest.deviceName}</div>
            <div className="text-sm text-muted-foreground">Device ID: {pairingRequest.deviceId}</div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="remember" className="text-sm font-medium">
                Remember this device
              </Label>
              <Switch
                id="remember"
                checked={rememberDevice}
                onCheckedChange={setRememberDevice}
              />
            </div>

            {rememberDevice && (
              <div className="ml-6 flex items-center justify-between">
                <Label htmlFor="autoConnect" className="text-sm font-medium">
                  Auto-connect when available
                </Label>
                <Switch
                  id="autoConnect"
                  checked={autoConnect}
                  onCheckedChange={setAutoConnect}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReject}>
            Reject
          </Button>
          <Button onClick={handleAccept}>Accept</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
