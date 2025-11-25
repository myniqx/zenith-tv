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
import { useProfilesStore } from './stores/profiles';
import { usePlayerStore } from '@zenith-tv/ui/stores/player';
import { useSettingsStore } from './stores/settings';
import { useDebounce } from './hooks/useDebounce';
import { Button } from '@zenith-tv/ui/button';
import { Input } from '@zenith-tv/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zenith-tv/ui/select';
import { X, Search, ChevronUp, ChevronDown, GripVertical, Layers } from 'lucide-react';
import type { GroupBy } from './stores/content';

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
  const [lastProfileLoaded, setLastProfileLoaded] = useState(false);
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
    groupBy,
    setGroupBy,
    setUserData,
  } = useContentStore();

  const {
    theme,
    autoLoadLastProfile,
    lastProfileUsername,
    lastProfileUUID,
    setLastProfile,
  } = useSettingsStore();

  const { profiles, selectProfile } = useProfilesStore();

  // Auto-load last profile on startup
  useEffect(() => {
    if (lastProfileLoaded)
      return; // dont let changing profile trigger this
    if (!autoLoadLastProfile || !lastProfileUsername || !lastProfileUUID) {
      setLastProfileLoaded(true);
      return;
    }
    if (!profiles || !profiles.length)
      return; // if lastProfileUsername exists maybe profiles are not loaded yet

    const profile = profiles.find((p) => p.username === lastProfileUsername);

    if (profile && profile.m3uRefs.includes(lastProfileUUID)) {
      selectProfile(lastProfileUsername, lastProfileUUID);
    }

    setLastProfileLoaded(true);
  }, [
    profiles,
    autoLoadLastProfile,
    lastProfileUsername,
    lastProfileUUID,
    selectProfile,
    setLastProfileLoaded,
  ]);

  // Save current profile when it changes
  useEffect(() => {
    if (autoLoadLastProfile && lastProfileUsername && lastProfileUUID) {
      setLastProfile(lastProfileUsername, lastProfileUUID);
    }
  }, [lastProfileUsername, lastProfileUUID, autoLoadLastProfile, setLastProfile]);


  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (resolvedTheme: 'dark' | 'light') => {
      root.classList.remove('light', 'dark');
      root.classList.add(resolvedTheme);
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches ? 'dark' : 'light');

      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      applyTheme(theme);
    }
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
            onResize={(size) => {
              setUserData(userData => ({
                ...userData,
                layoutData: {
                  ...userData.layoutData,
                  categoryPanelSize: size,
                },
              }));
            }}
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
                  <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
                    <SelectTrigger className="w-[140px]" aria-label="Group content by">
                      <Layers className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Group by..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Grouping</SelectItem>
                      <SelectItem value="group">By Group</SelectItem>
                      <SelectItem value="year">By Year</SelectItem>
                      <SelectItem value="alphabetic">Alphabetic</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'name' | 'date' | 'recent')}>
                    <SelectTrigger className="w-[150px]" aria-label="Sort content by">
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
              </div>

              {/* Content Grid and Video Player */}
              <div className="flex-1 overflow-hidden">
                <PanelGroup direction="horizontal" autoSaveId="content-layout">
                  <Panel
                    defaultSize={50}
                    minSize={30}
                    onResize={(size) => {
                      setUserData(userData => ({
                        ...userData,
                        layoutData: {
                          ...userData.layoutData,
                          contentPanelSize: size,
                        },
                      }));
                    }}>
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
