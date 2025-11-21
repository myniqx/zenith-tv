import { useState, useEffect, useRef } from 'react';
import { VideoPlayer } from './components/VideoPlayer';
import { ProfileManager } from './components/ProfileManager';
import { CategoryBrowser } from './components/CategoryBrowser';
import { ContentGrid } from './components/ContentGrid';
import { ToastContainer } from './components/ToastContainer';
import { Settings } from './components/Settings';
import { PairingDialog } from './components/PairingDialog';
import { RemoteControlIndicator } from './components/RemoteControlIndicator';
import { useProfilesStore } from './stores/profiles';
import { useContentStore } from './stores/content';
import { usePlayerStore } from '@zenith-tv/ui/stores/player';
import { useSettingsStore } from './stores/settings';
import { useDebounce } from './hooks/useDebounce';
import { Button } from '@zenith-tv/ui/button';
import { Input } from '@zenith-tv/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zenith-tv/ui/select';
import { Settings as SettingsIcon, User, Menu, X, Search, ChevronUp, ChevronDown } from 'lucide-react';

function App() {
  const [showBrowser, setShowBrowser] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [p2pEnabled, setP2pEnabled] = useState(false);
  const [p2pDeviceInfo, setP2pDeviceInfo] = useState<any>(null);
  const [pairingRequest, setPairingRequest] = useState<any>(null);
  const [controlledBy, setControlledBy] = useState<string | null>(null);

  const debouncedSearchQuery = useDebounce(localSearchQuery, 300);

  const { profiles, getCurrentUsername } = useProfilesStore();

  const {
    setSearchQuery,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    getFilteredItems,
  } = useContentStore();

  const currentUsername = getCurrentUsername();

  const { theme } = useSettingsStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    setSearchQuery(debouncedSearchQuery);
  }, [debouncedSearchQuery, setSearchQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const startP2P = async () => {
      try {
        const info = await window.electron.p2p.start(8080);
        setP2pDeviceInfo(info);
        setP2pEnabled(true);
      } catch (error) {
        console.error('Failed to start P2P server:', error);
      }
    };

    startP2P();

    return () => {
      window.electron.p2p.stop();
    };
  }, []);

  useEffect(() => {
    window.electron.p2p.onPairingRequest((request) => {
      setPairingRequest(request);
    });

    window.electron.p2p.onPlay(({ item, position }) => {
      const { play } = usePlayerStore.getState();
      play(item);
      if (position !== undefined) {
        const videoElement = document.querySelector('video');
        if (videoElement) {
          videoElement.currentTime = position;
        }
      }
    });

    window.electron.p2p.onPause(() => {
      const videoElement = document.querySelector('video');
      if (videoElement) {
        videoElement.pause();
      }
    });

    window.electron.p2p.onSeek((position) => {
      const videoElement = document.querySelector('video');
      if (videoElement) {
        videoElement.currentTime = position;
      }
    });

    window.electron.p2p.onSetVolume((volume) => {
      const { setVolume } = usePlayerStore.getState();
      setVolume(volume);
    });
  }, []);

  useEffect(() => {
    if (!p2pEnabled) return;

    const { currentItem, state, position, volume } = usePlayerStore.getState();

    const broadcastState = () => {
      window.electron.p2p.broadcastState({
        currentItem,
        state,
        position,
        volume,
      });
    };

    const interval = setInterval(broadcastState, 2000);

    return () => clearInterval(interval);
  }, [p2pEnabled]);

  const handleAcceptPairing = async (deviceId: string, pin: string) => {
    const accepted = await window.electron.p2p.acceptPairing(deviceId, pin);
    if (accepted && pairingRequest) {
      setControlledBy(pairingRequest.deviceName);
      setPairingRequest(null);
    }
  };

  const handleRejectPairing = (deviceId: string) => {
    window.electron.p2p.rejectPairing(deviceId);
    setPairingRequest(null);
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card" role="banner">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Zenith TV
          </h1>
          {currentUsername && (
            <span className="text-sm text-muted-foreground" aria-label={`Current profile: ${currentUsername}`}>
              • {currentUsername}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowSettings(true)}
            variant="ghost"
            size="icon"
            title="Settings"
            aria-label="Open settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </Button>

          <ProfileManager />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden" role="main">
        {showBrowser && <CategoryBrowser />}

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border gap-4" role="toolbar" aria-label="Content controls">
            <Button
              onClick={() => setShowBrowser(!showBrowser)}
              variant="ghost"
              size="sm"
              aria-label={showBrowser ? 'Hide category browser' : 'Show category browser'}
              aria-pressed={showBrowser}
            >
              <Menu className="w-4 h-4 mr-2" />
              {showBrowser ? 'Hide Browser' : 'Show Browser'}
            </Button>

            <div className="flex-1 max-w-md relative" role="search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                placeholder="Search by title or group... (Ctrl+F)"
                className="pl-10 pr-10"
                aria-label="Search content by title or group"
              />
              {localSearchQuery && (
                <Button
                  onClick={() => setLocalSearchQuery('')}
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                <SelectTrigger className="w-[180px]" aria-label="Sort content by">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort by Name</SelectItem>
                  <SelectItem value="date">Sort by Date</SelectItem>
                  <SelectItem value="recent">Sort by Recent</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                variant="ghost"
                size="icon"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                aria-label={`Sort order: ${sortOrder === 'asc' ? 'ascending' : 'descending'}. Click to toggle`}
              >
                {sortOrder === 'asc' ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>

            <div className="text-sm text-muted-foreground whitespace-nowrap" aria-live="polite" aria-atomic="true">
              {getFilteredItems().length} items
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 overflow-hidden">
            <div className="overflow-hidden">
              <ContentGrid />
            </div>

            <div className="border-l border-border">
              <VideoPlayer />
            </div>
          </div>
        </div>
      </main>


      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
      )}

      {pairingRequest && (
        <PairingDialog
          deviceName={pairingRequest.deviceName}
          pin={pairingRequest.pin}
          onAccept={(pin) => handleAcceptPairing(pairingRequest.deviceId, pin)}
          onReject={() => handleRejectPairing(pairingRequest.deviceId)}
        />
      )}

      <RemoteControlIndicator
        controlledBy={controlledBy}
        isServerRunning={p2pEnabled}
        deviceInfo={p2pDeviceInfo}
      />

      <ToastContainer />
    </div>
  );
}

export default App;
