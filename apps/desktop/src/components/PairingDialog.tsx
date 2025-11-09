/**
 * P2P Pairing Dialog
 */
import { useState } from 'react';

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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="pairing-title">
      <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full mx-4 border border-gray-700">
        <div className="text-center mb-6">
          <div className="text-5xl mb-4" aria-hidden="true">🔗</div>
          <h2 id="pairing-title" className="text-2xl font-bold text-white mb-2">
            Pairing Request
          </h2>
          <p className="text-gray-400">
            {deviceName} wants to connect
          </p>
        </div>

        <div className="mb-6">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-400 mb-2">Enter PIN to pair:</p>
            <p className="text-4xl font-mono font-bold text-blue-500 tracking-widest">
              {pin}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={inputPin}
            onChange={(e) => {
              setInputPin(e.target.value);
              setError('');
            }}
            placeholder="Enter PIN"
            className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700
                     focus:border-blue-500 focus:outline-none text-center text-2xl font-mono tracking-widest"
            maxLength={4}
            autoFocus
            aria-label="Enter pairing PIN"
            aria-invalid={!!error}
            aria-describedby={error ? 'pin-error' : undefined}
          />
          {error && (
            <p id="pin-error" className="text-red-500 text-sm mt-2 text-center" role="alert">{error}</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg
                     transition-colors font-medium"
            aria-label={`Reject pairing request from ${deviceName}`}
          >
            Reject
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                     transition-colors font-medium"
            aria-label={`Accept pairing request from ${deviceName}`}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
