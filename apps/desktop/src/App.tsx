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
import { usePlayerStore } from '@zenith-tv/ui/src/stores/player';
import { useSettingsStore } from './stores/settings';
import { useDebounce } from './hooks/useDebounce';
import { db } from './services/database';

function App() {
  const [showProfileManager, setShowProfileManager] = useState(false);
  const [showBrowser, setShowBrowser] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // P2P State
  const [p2pEnabled, setP2pEnabled] = useState(false);
  const [p2pDeviceInfo, setP2pDeviceInfo] = useState<any>(null);
  const [pairingRequest, setPairingRequest] = useState<any>(null);
  const [controlledBy, setControlledBy] = useState<string | null>(null);

  // Debounce search query for performance
  const debouncedSearchQuery = useDebounce(localSearchQuery, 300);

  const {
    profiles,
    currentProfile,
    loadProfiles,
    addProfile,
    addProfileFromFile,
    selectProfile,
    deleteProfile,
    syncProfile,
    isLoading: isSyncing,
    syncProgress,
  } = useProfilesStore();

  const {
    currentCategory,
    setCategory,
    getFilteredItems,
    toggleFavorite,
    setSearchQuery,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    isLoading,
  } = useContentStore();

  const { play } = usePlayerStore();
  const { highContrastMode } = useSettingsStore();

  // Load profiles and clean cache on mount
  useEffect(() => {
    const init = async () => {
      // Clean expired cache entries
      await db.cleanExpiredCache();

      // Load profiles
      await loadProfiles();
    };

    init();
  }, [loadProfiles]);

  // Show profile manager if no profiles exist
  useEffect(() => {
    if (profiles.length === 0) {
      setShowProfileManager(true);
    }
  }, [profiles.length]);

  // Apply debounced search query to store
  useEffect(() => {
    setSearchQuery(debouncedSearchQuery);
  }, [debouncedSearchQuery, setSearchQuery]);

  // Keyboard shortcut for search (Ctrl+F)
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

  // Start P2P server on mount
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

  // P2P event listeners
  useEffect(() => {
    // Pairing request
    window.electron.p2p.onPairingRequest((request) => {
      setPairingRequest(request);
    });

    // Play command
    window.electron.p2p.onPlay(({ item, position }) => {
      play(item);
      if (position !== undefined) {
        const videoElement = document.querySelector('video');
        if (videoElement) {
          videoElement.currentTime = position;
        }
      }
    });

    // Pause command
    window.electron.p2p.onPause(() => {
      const videoElement = document.querySelector('video');
      if (videoElement) {
        videoElement.pause();
      }
    });

    // Seek command
    window.electron.p2p.onSeek((position) => {
      const videoElement = document.querySelector('video');
      if (videoElement) {
        videoElement.currentTime = position;
      }
    });

    // Set volume command
    window.electron.p2p.onSetVolume((volume) => {
      const { setVolume } = usePlayerStore.getState();
      setVolume(volume);
    });
  }, [play]);

  // Broadcast player state changes to remote devices
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

    // Broadcast state changes every 2 seconds while playing
    const interval = setInterval(broadcastState, 2000);

    return () => clearInterval(interval);
  }, [p2pEnabled]);

  const handleAddProfile = (url: string, name: string) => {
    addProfile(url, name);
  };

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
    <div className={`flex flex-col h-screen ${highContrastMode ? 'high-contrast' : 'bg-gray-900 text-white'}`}>
      {/* Header */}
      <header className={`flex items-center justify-between px-6 py-3 border-b ${highContrastMode ? 'high-contrast-header' : 'bg-gray-800 border-gray-700'}`} role="banner">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Zenith TV
          </h1>
          {currentProfile && (
            <span className="text-sm text-gray-400" aria-label={`Current profile: ${currentProfile.name}`}>
              • {currentProfile.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg
                     transition-colors"
            title="Settings"
            aria-label="Open settings"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
            </svg>
          </button>

          <button
            onClick={() => setShowProfileManager(true)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg
                     transition-colors flex items-center gap-2"
            aria-label="Manage profiles"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
            Profiles
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden" role="main">
        {/* Category Browser */}
        {showBrowser && (
          <CategoryBrowser
            currentCategory={currentCategory}
            onCategoryChange={setCategory}
          />
        )}

        {/* Content Grid or Player */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-700 gap-4" role="toolbar" aria-label="Content controls">
            <button
              onClick={() => setShowBrowser(!showBrowser)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm
                       transition-colors flex items-center gap-2"
              aria-label={showBrowser ? 'Hide category browser' : 'Show category browser'}
              aria-pressed={showBrowser}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                {showBrowser ? (
                  <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                ) : (
                  <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                )}
              </svg>
              {showBrowser ? 'Hide Browser' : 'Show Browser'}
            </button>

            {/* Search */}
            <div className="flex-1 max-w-md relative" role="search">
              <input
                ref={searchInputRef}
                type="text"
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                placeholder="Search by title or group... (Ctrl+F)"
                className="w-full px-4 py-1.5 pl-10 bg-gray-700 border border-gray-600 rounded
                         text-white placeholder-gray-400 focus:outline-none focus:border-blue-500
                         text-sm"
                aria-label="Search content by title or group"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
              {localSearchQuery && (
                <button
                  onClick={() => setLocalSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm
                         text-white focus:outline-none focus:border-blue-500"
                aria-label="Sort content by"
              >
                <option value="name">Sort by Name</option>
                <option value="date">Sort by Date</option>
                <option value="recent">Sort by Recent</option>
              </select>

              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                aria-label={`Sort order: ${sortOrder === 'asc' ? 'ascending' : 'descending'}. Click to toggle`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  {sortOrder === 'asc' ? (
                    <path d="M7 14l5-5 5 5z" />
                  ) : (
                    <path d="M7 10l5 5 5-5z" />
                  )}
                </svg>
              </button>
            </div>

            <div className="text-sm text-gray-400 whitespace-nowrap" aria-live="polite" aria-atomic="true">
              {getFilteredItems().length} items
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 grid grid-cols-2 overflow-hidden">
            {/* Content Grid */}
            <div className="overflow-hidden">
              <ContentGrid
                items={getFilteredItems()}
                onItemClick={(item) => play(item)}
                onToggleFavorite={toggleFavorite}
                isLoading={isLoading}
              />
            </div>

            {/* Video Player */}
            <div className="border-l border-gray-700">
              <VideoPlayer />
            </div>
          </div>
        </div>
      </main>

      {/* Profile Manager Modal */}
      {showProfileManager && (
        <ProfileManager
          profiles={profiles}
          currentProfile={currentProfile}
          onAddProfile={handleAddProfile}
          onAddProfileFromFile={addProfileFromFile}
          onSelectProfile={(profile) => {
            selectProfile(profile);
            setShowProfileManager(false);
          }}
          onDeleteProfile={deleteProfile}
          onSyncProfile={syncProfile}
          onClose={() => setShowProfileManager(false)}
          syncProgress={syncProgress}
          isSyncing={isSyncing}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
      )}

      {/* Pairing Dialog */}
      {pairingRequest && (
        <PairingDialog
          deviceName={pairingRequest.deviceName}
          pin={pairingRequest.pin}
          onAccept={(pin) => handleAcceptPairing(pairingRequest.deviceId, pin)}
          onReject={() => handleRejectPairing(pairingRequest.deviceId)}
        />
      )}

      {/* Remote Control Indicator */}
      <RemoteControlIndicator
        controlledBy={controlledBy}
        isServerRunning={p2pEnabled}
        deviceInfo={p2pDeviceInfo}
      />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

export default App;
