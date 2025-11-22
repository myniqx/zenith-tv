import { useState, useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { VideoPlayer } from './components/VideoPlayer';
import { CategoryBrowser } from './components/CategoryBrowser';
import { ContentGrid } from './components/ContentGrid';
import { ToastContainer } from './components/ToastContainer';
import { HeaderBar } from './components/HeaderBar';
import { PairingDialog } from './components/PairingDialog';
import { RemoteControlIndicator } from './components/RemoteControlIndicator';
import { useContentStore } from './stores/content';
import { usePlayerStore } from '@zenith-tv/ui/stores/player';
import { useSettingsStore } from './stores/settings';
import { useDebounce } from './hooks/useDebounce';
import { Button } from '@zenith-tv/ui/button';
import { Input } from '@zenith-tv/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zenith-tv/ui/select';
import { X, Search, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';

function ResizeHandle({ className = '' }: { className?: string }) {
  return (
    <PanelResizeHandle
      className={`group flex items-center justify-center bg-border/50 hover:bg-primary/20 transition-colors ${className}`}
    >
      <GripVertical className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
    </PanelResizeHandle>
  );
}

function App() {
  const [isCategoryCollapsed, setIsCategoryCollapsed] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [p2pEnabled, setP2pEnabled] = useState(false);
  const [p2pDeviceInfo, setP2pDeviceInfo] = useState<unknown>(null);
  const [pairingRequest, setPairingRequest] = useState<unknown>(null);
  const [controlledBy, setControlledBy] = useState<string | null>(null);

  const debouncedSearchQuery = useDebounce(localSearchQuery, 300);

  const {
    setSearchQuery,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    getFilteredItems,
  } = useContentStore();

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
      <HeaderBar />

      <main className="flex-1 overflow-hidden" role="main">
        <PanelGroup direction="horizontal" autoSaveId="main-layout">
          {/* Category Browser Panel - Collapsible */}
          <Panel
            collapsible
            defaultSize={18}
            minSize={4}
            maxSize={30}
            onCollapse={() => setIsCategoryCollapsed(true)}
            onExpand={() => setIsCategoryCollapsed(false)}
          >
            <CategoryBrowser isCollapsed={isCategoryCollapsed} />
          </Panel>

          <ResizeHandle className="w-1.5" />

          {/* Main Content Panel */}
          <Panel minSize={50}>
            <div className="h-full flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border gap-4" role="toolbar" aria-label="Content controls">
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
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'name' | 'date' | 'recent')}>
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

              {/* Content Grid and Video Player */}
              <div className="flex-1 overflow-hidden">
                <PanelGroup direction="horizontal" autoSaveId="content-layout">
                  <Panel defaultSize={50} minSize={30}>
                    <div className="h-full overflow-hidden">
                      <ContentGrid />
                    </div>
                  </Panel>

                  <ResizeHandle className="w-1.5" />

                  <Panel defaultSize={50} minSize={30}>
                    <div className="h-full">
                      <VideoPlayer />
                    </div>
                  </Panel>
                </PanelGroup>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </main>

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
