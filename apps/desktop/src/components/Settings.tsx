import { useSettingsStore } from '../stores/settings';
import { useToastStore } from '../stores/toast';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const {
    theme,
    highContrastMode,
    language,
    defaultCategory,
    autoSyncInterval,
    defaultVolume,
    autoResume,
    autoPlayNext,
    deviceName,
    serverPort,
    setTheme,
    setHighContrastMode,
    setLanguage,
    setDefaultCategory,
    setAutoSyncInterval,
    setDefaultVolume,
    setAutoResume,
    setAutoPlayNext,
    setDeviceName,
    setServerPort,
    resetSettings,
  } = useSettingsStore();

  const toast = useToastStore();

  const handleReset = () => {
    if (confirm('Reset all settings to default values?')) {
      resetSettings();
      toast.success('Settings reset to defaults');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-8">
            {/* Appearance */}
            <section>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                </svg>
                Appearance
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Theme
                  </label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as any)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg
                             text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="dark">Dark</option>
                    <option value="light" disabled>Light (Coming Soon)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg
                             text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="en">English</option>
                    <option value="tr" disabled>Türkçe (Coming Soon)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-300">
                      High Contrast Mode
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Increase contrast for better visibility
                    </p>
                  </div>
                  <button
                    onClick={() => setHighContrastMode(!highContrastMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                              ${highContrastMode ? 'bg-blue-600' : 'bg-gray-700'}`}
                    aria-label={`High contrast mode ${highContrastMode ? 'enabled' : 'disabled'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                ${highContrastMode ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              </div>
            </section>

            {/* Content */}
            <section>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
                </svg>
                Content
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Default Category
                  </label>
                  <select
                    value={defaultCategory}
                    onChange={(e) => setDefaultCategory(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg
                             text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="movies">Movies</option>
                    <option value="series">Series</option>
                    <option value="live">Live TV</option>
                    <option value="favorites">Favorites</option>
                    <option value="recent">Recent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Auto-Sync Interval
                  </label>
                  <select
                    value={autoSyncInterval}
                    onChange={(e) => setAutoSyncInterval(parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg
                             text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="0">Disabled</option>
                    <option value="30">Every 30 minutes</option>
                    <option value="60">Every hour</option>
                    <option value="360">Every 6 hours</option>
                    <option value="1440">Daily</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Automatically sync M3U playlists in the background
                  </p>
                </div>
              </div>
            </section>

            {/* Player */}
            <section>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Player
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Default Volume: {Math.round(defaultVolume * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={defaultVolume * 100}
                    onChange={(e) => setDefaultVolume(parseInt(e.target.value) / 100)}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                             accent-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-300">
                      Auto-Resume Playback
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Continue from where you left off
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoResume(!autoResume)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                              ${autoResume ? 'bg-blue-600' : 'bg-gray-700'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                ${autoResume ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-300">
                      Auto-Play Next Episode
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Automatically play next episode when current ends
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoPlayNext(!autoPlayNext)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                              ${autoPlayNext ? 'bg-blue-600' : 'bg-gray-700'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                ${autoPlayNext ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              </div>
            </section>

            {/* Network */}
            <section>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15.9 5c-.17 0-.32.09-.41.23l-.07.15-5.18 11.65c-.16.29-.26.61-.26.96 0 1.11.9 2.01 2.01 2.01.96 0 1.77-.68 1.96-1.59l.01-.03L16.4 5.5c0-.28-.22-.5-.5-.5zM1 9l2 2c2.88-2.88 6.79-4.08 10.53-3.62l1.19-2.68C9.89 3.84 4.74 5.27 1 9zm20 2l2-2c-1.64-1.64-3.55-2.82-5.59-3.57l-.53 2.82c1.5.62 2.9 1.53 4.12 2.75zm-4 4l2-2c-.8-.8-1.7-1.42-2.66-1.89l-.55 2.92c.42.27.83.59 1.21.97zM5 13l2 2c1.13-1.13 2.56-1.79 4.03-2l1.28-2.88c-2.63-.08-5.3.87-7.31 2.88z" />
                </svg>
                Network (P2P Remote Control)
              </h3>
              <div className="space-y-4 opacity-50">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Device Name
                  </label>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    disabled
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg
                             text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Server Port
                  </label>
                  <input
                    type="number"
                    value={serverPort}
                    onChange={(e) => setServerPort(parseInt(e.target.value))}
                    disabled
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg
                             text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Coming in Phase 3 - P2P Remote Control
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-800">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg
                     transition-colors text-sm font-medium"
          >
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg
                     transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
