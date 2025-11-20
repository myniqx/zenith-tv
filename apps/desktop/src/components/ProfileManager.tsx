import { useState } from 'react';
import type { BackendProfile } from '../services/profile-service';
import type { M3UInfo } from '../services/m3u-service';

interface ProfileManagerProps {
  profiles: BackendProfile[];
  currentUsername: string | null;
  currentM3U: M3UInfo | null;
  m3uList: M3UInfo[];
  onAddProfile: (username: string, m3uUrl: string) => void;
  onAddProfileFromFile: () => void;
  onSelectProfile: (username: string) => void;
  onSelectM3U: (m3uInfo: M3UInfo) => void;
  onDeleteProfile: (username: string) => void;
  onSyncM3U: (m3uInfo: M3UInfo) => void;
  onAddM3UToProfile: (username: string, m3uUrl: string) => void;
  onRemoveM3UFromProfile: (username: string, uuid: string) => void;
  onClose: () => void;
  syncProgress?: { stage: string; percent: number } | null;
  isSyncing?: boolean;
}

export function ProfileManager({
  profiles,
  currentUsername,
  currentM3U,
  m3uList,
  onAddProfile,
  onAddProfileFromFile,
  onSelectProfile,
  onSelectM3U,
  onDeleteProfile,
  onSyncM3U,
  onAddM3UToProfile,
  onRemoveM3UFromProfile,
  onClose,
  syncProgress,
  isSyncing,
}: ProfileManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddM3UForm, setShowAddM3UForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newM3UUrl, setNewM3UUrl] = useState('');

  const handleSubmitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUrl.trim() && newUsername.trim()) {
      onAddProfile(newUsername.trim(), newUrl.trim());
      setNewUrl('');
      setNewUsername('');
      setShowAddForm(false);
    }
  };

  const handleAddM3U = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUsername && newM3UUrl.trim()) {
      onAddM3UToProfile(currentUsername, newM3UUrl.trim());
      setNewM3UUrl('');
      setShowAddM3UForm(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white">Profile Manager</h2>
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
          {/* Add Profile Buttons */}
          {!showAddForm && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setShowAddForm(true)}
                className="p-4 border-2 border-dashed border-gray-700 rounded-lg
                           hover:border-blue-500 hover:bg-blue-500/10 transition-colors
                           flex items-center justify-center gap-2 text-gray-400 hover:text-blue-400"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
                Add Profile from URL
              </button>

              <button
                onClick={onAddProfileFromFile}
                disabled={isSyncing}
                className="p-4 border-2 border-dashed border-gray-700 rounded-lg
                           hover:border-green-500 hover:bg-green-500/10 transition-colors
                           flex items-center justify-center gap-2 text-gray-400 hover:text-green-400
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                </svg>
                Import from File
              </button>
            </div>
          )}

          {/* Add Profile Form */}
          {showAddForm && (
            <form onSubmit={handleSubmitProfile} className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Add New Profile</h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username (unique identifier)
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g., john_doe or my-iptv"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg
                           text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  M3U URL
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com/playlist.m3u"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg
                           text-white placeholder-gray-500 focus:outline-none focus:border-blue-500
                           font-mono text-sm"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg
                           font-medium transition-colors"
                >
                  Create Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewUrl('');
                    setNewUsername('');
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg
                           transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Profiles List */}
          {profiles.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📺</div>
              <h3 className="text-xl font-semibold text-gray-300 mb-2">
                No profiles yet
              </h3>
              <p className="text-gray-500">
                Add your first M3U playlist to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {profiles.map((profile) => (
                <div
                  key={profile.username}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    currentUsername === profile.username
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 bg-gray-800/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white text-lg">
                          {profile.username}
                        </h3>
                        {currentUsername === profile.username && (
                          <span className="px-2 py-0.5 bg-blue-500 text-xs rounded-full font-medium">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {profile.m3uRefs.length} M3U source{profile.m3uRefs.length !== 1 ? 's' : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onSelectProfile(profile.username)}
                        className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors
                                 text-gray-400 hover:text-blue-400"
                        title="Select profile"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Delete profile "${profile.username}"?`)) {
                            onDeleteProfile(profile.username);
                          }
                        }}
                        disabled={isSyncing}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors
                                 text-gray-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete profile"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* M3U List for this profile */}
                  {currentUsername === profile.username && m3uList.length > 0 && (
                    <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-700">
                      {m3uList.map((m3u) => (
                        <div
                          key={m3u.uuid}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            currentM3U?.uuid === m3u.uuid
                              ? 'border-blue-400 bg-blue-500/5'
                              : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                          }`}
                          onClick={() => onSelectM3U(m3u)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-300 font-mono truncate">
                                {m3u.url}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                {m3u.stats && (
                                  <p className="text-xs text-gray-500">
                                    {m3u.stats.totalItems} items
                                  </p>
                                )}
                                {m3u.hasSource ? (
                                  <span className="text-xs text-green-500">✓ Cached</span>
                                ) : (
                                  <span className="text-xs text-yellow-500">⚠ Not synced</span>
                                )}
                              </div>

                              {/* Sync Progress */}
                              {isSyncing && currentM3U?.uuid === m3u.uuid && syncProgress && (
                                <div className="mt-2">
                                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                                    <span>{syncProgress.stage}</span>
                                    <span>{Math.round(syncProgress.percent)}%</span>
                                  </div>
                                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                                    <div
                                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                      style={{ width: `${syncProgress.percent}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1 ml-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSyncM3U(m3u);
                                }}
                                disabled={isSyncing}
                                className="p-1.5 hover:bg-blue-500/20 rounded transition-colors
                                         text-gray-400 hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Sync M3U"
                              >
                                <svg
                                  className={`w-4 h-4 ${isSyncing && currentM3U?.uuid === m3u.uuid ? 'animate-spin' : ''}`}
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
                                </svg>
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Remove this M3U from profile?')) {
                                    onRemoveM3UFromProfile(profile.username, m3u.uuid);
                                  }
                                }}
                                disabled={isSyncing}
                                className="p-1.5 hover:bg-red-500/20 rounded transition-colors
                                         text-gray-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Remove M3U"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Add M3U Button */}
                      {!showAddM3UForm && (
                        <button
                          onClick={() => setShowAddM3UForm(true)}
                          className="w-full p-3 border-2 border-dashed border-gray-700 rounded-lg
                                   hover:border-blue-500 hover:bg-blue-500/10 transition-colors
                                   flex items-center justify-center gap-2 text-gray-400 hover:text-blue-400 text-sm"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                          </svg>
                          Add Another M3U
                        </button>
                      )}

                      {/* Add M3U Form */}
                      {showAddM3UForm && (
                        <form onSubmit={handleAddM3U} className="p-3 bg-gray-900 rounded-lg border border-gray-700">
                          <input
                            type="url"
                            value={newM3UUrl}
                            onChange={(e) => setNewM3UUrl(e.target.value)}
                            placeholder="https://example.com/playlist.m3u"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg mb-2
                                     text-white placeholder-gray-500 focus:outline-none focus:border-blue-500
                                     font-mono text-sm"
                            required
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm
                                       font-medium transition-colors"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddM3UForm(false);
                                setNewM3UUrl('');
                              }}
                              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm
                                       transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
