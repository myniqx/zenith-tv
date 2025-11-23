import { Badge } from '@zenith-tv/ui/badge';
import { CheckCircle2, Wifi } from 'lucide-react';

interface RemoteControlIndicatorProps {
  controlledBy: string | null;
  isServerRunning: boolean;
  deviceInfo?: {
    id: string;
    name: string;
    port: number;
  };
}

export function RemoteControlIndicator({
  controlledBy,
  isServerRunning,
  deviceInfo,
}: RemoteControlIndicatorProps) {
  if (!isServerRunning && !controlledBy) {
    return null;
  }

  return (
    <div className="fixed top-2 right-50 z-30" role="status" aria-live="polite">
      {controlledBy && (
        <Badge
          variant="secondary"
          className="bg-purple-600/90 hover:bg-purple-600/90 backdrop-blur-sm text-white px-4 py-2 flex items-center gap-2 animate-pulse"
          aria-label={`Remote control active. Device is being controlled by ${controlledBy}`}
        >
          <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          <span className="font-medium">Controlled by {controlledBy}</span>
        </Badge>
      )}

      {isServerRunning && !controlledBy && (
        <Badge
          variant="secondary"
          className="bg-green-600/90 hover:bg-green-600/90 backdrop-blur-sm text-white px-4 py-2 flex items-center gap-2"
          aria-label={`Remote control server running on port ${deviceInfo?.port || 'unknown'}`}
        >
          <Wifi className="w-4 h-4 animate-pulse" aria-hidden="true" />
          <div className="text-sm">
            <div className="font-medium">Remote Control Active</div>
            {deviceInfo && (
              <div className="text-xs opacity-90">Port: {deviceInfo.port}</div>
            )}
          </div>
        </Badge>
      )}
    </div>
  );
}
