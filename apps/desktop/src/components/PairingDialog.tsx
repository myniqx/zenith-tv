import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@zenith-tv/ui/dialog';
import { Button } from '@zenith-tv/ui/button';
import { Input } from '@zenith-tv/ui/input';
import { Card, CardContent } from '@zenith-tv/ui/card';
import { Link2 } from 'lucide-react';

interface PairingDialogProps {
  deviceName: string;
  pin: string;
  onAccept: (pin: string) => void;
  onReject: () => void;
}

export function PairingDialog({ deviceName, pin, onAccept, onReject }: PairingDialogProps) {
  const [inputPin, setInputPin] = useState('');
  const [error, setError] = useState('');

  const handleAccept = () => {
    if (inputPin !== pin) {
      setError('Incorrect PIN');
      return;
    }
    onAccept(inputPin);
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onReject()}>
      <DialogContent className="max-w-md" aria-describedby="pairing-description">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4">
            <Link2 className="w-12 h-12 text-primary" />
          </div>
          <DialogTitle className="text-2xl">Pairing Request</DialogTitle>
          <DialogDescription id="pairing-description">
            {deviceName} wants to connect
          </DialogDescription>
        </DialogHeader>

        <Card className="mb-4">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Enter PIN to pair:</p>
            <p className="text-4xl font-mono font-bold text-primary tracking-widest">
              {pin}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Input
            type="text"
            value={inputPin}
            onChange={(e) => {
              setInputPin(e.target.value);
              setError('');
            }}
            placeholder="Enter PIN"
            className="text-center text-2xl font-mono tracking-widest h-14"
            maxLength={4}
            autoFocus
            aria-label="Enter pairing PIN"
            aria-invalid={!!error}
            aria-describedby={error ? 'pin-error' : undefined}
          />
          {error && (
            <p id="pin-error" className="text-destructive text-sm text-center" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 mt-4">
          <Button
            variant="outline"
            onClick={onReject}
            className="flex-1"
            aria-label={`Reject pairing request from ${deviceName}`}
          >
            Reject
          </Button>
          <Button
            onClick={handleAccept}
            className="flex-1"
            aria-label={`Accept pairing request from ${deviceName}`}
          >
            Accept
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
