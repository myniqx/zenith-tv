import { useEffect } from 'react';
import { useP2PStore } from '../../stores/p2pStore';
import { Button } from '@zenith-tv/ui/button';

export function PairingRequestToast() {
  const { pairingRequest, acceptPairing, rejectPairing } = useP2PStore();

  useEffect(() => {
    if (pairingRequest) {
      // We need a custom toast for this, but useToastStore only supports simple messages.
      // For now, let's just show a simple message with actions if possible, 
      // OR we might need to extend the toast store or use a different approach.
      // The current ToastContainer renders simple toasts.

      // Let's modify ToastContainer to support custom content or actions?
      // Or just render a fixed dialog/toast here directly without using the store?
      // The previous implementation used a custom component rendered in App.tsx.
      // Let's stick to that pattern but make it look like a toast.

      // So we don't use useToastStore here, we just render the component if pairingRequest exists.
      // But wait, the user wanted "modern components".
      // Rendering a fixed "toast-like" div in App.tsx is fine.
    }
  }, [pairingRequest]);

  if (!pairingRequest) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] bg-background border border-border rounded-lg shadow-lg p-4 w-80 animate-slide-in-right">
      <div className="flex flex-col gap-3">
        <div className="font-medium">Pairing Request</div>
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{pairingRequest.deviceName}</span> wants to connect.
          {pairingRequest.pin && (
            <div className="mt-1">
              PIN: <span className="font-mono bg-muted px-1 rounded">{pairingRequest.pin}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => rejectPairing()}
          >
            Reject
          </Button>
          <Button
            size="sm"
            onClick={() => acceptPairing()}
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
