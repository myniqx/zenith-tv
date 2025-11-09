/**
 * Remote Control Status Indicator
 */
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
    <div className="fixed top-20 right-4 z-30" role="status" aria-live="polite">
      {controlledBy && (
        <div className="bg-purple-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg
                      shadow-lg flex items-center gap-2 animate-pulse"
             aria-label={`Remote control active. Device is being controlled by ${controlledBy}`}>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          <span className="font-medium">Controlled by {controlledBy}</span>
        </div>
      )}

      {isServerRunning && !controlledBy && (
        <div className="bg-green-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg
                      shadow-lg flex items-center gap-2"
             aria-label={`Remote control server running on port ${deviceInfo?.port || 'unknown'}`}>
          <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse" aria-hidden="true" />
          <div className="text-sm">
            <div className="font-medium">Remote Control Active</div>
            {deviceInfo && (
              <div className="text-xs opacity-90">Port: {deviceInfo.port}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
