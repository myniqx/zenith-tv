import { useState, useEffect, useMemo } from 'react';
import { useProfilesStore } from '../stores/profiles';
import { Button } from '@zenith-tv/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@zenith-tv/ui/dialog';
import { Input } from '@zenith-tv/ui/input';
import { Label } from '@zenith-tv/ui/label';
import { Card, CardContent } from '@zenith-tv/ui/card';
import { Badge } from '@zenith-tv/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@zenith-tv/ui/alert-dialog';
import { X, Plus, Check, Trash2, RefreshCw, Tv, User, Film, Radio, FolderOpen } from 'lucide-react';
import { useContentStore, type M3UStats } from '@/stores/content';
import { fileSystem } from '@/libs';
import { cn } from '@zenith-tv/ui/lib/cn';

type SourceType = 'url' | 'file';

const getM3UStats = (uuid: string) => `m3u/${uuid}/stats.json`;

export function ProfileManager() {
  const {
    profiles,
    createProfile,
    createProfileFromFile,
    selectProfile,
    deleteProfile,
    addM3UToProfile,
    removeM3UFromProfile,
    getCurrentUsername,
    getCurrentUUID,
    getUrlFromUUID,
  } = useProfilesStore();

  const update = useContentStore(s => s.update);

  const [selectedProfileUsername, setSelectedProfileUsername] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddM3UForm, setShowAddM3UForm] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>('url');
  const [newUsername, setNewUsername] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newM3UUrl, setNewM3UUrl] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'profile' | 'm3u'; username?: string; uuid?: string } | null>(null);
  const [statsMap, setStatsMap] = useState<Record<string, M3UStats>>({});

  const currentUsername = getCurrentUsername();
  const currentUUID = getCurrentUUID();

  // Sort profiles by lastLogin (most recent first)
  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));
  }, [profiles]);

  // Get selected profile (default to current or first)
  const selectedProfile = useMemo(() => {
    if (selectedProfileUsername) {
      return profiles.find(p => p.username === selectedProfileUsername);
    }
    if (currentUsername) {
      return profiles.find(p => p.username === currentUsername);
    }
    return sortedProfiles[0];
  }, [profiles, selectedProfileUsername, currentUsername, sortedProfiles]);

  // Load stats for selected profile's M3U sources
  useEffect(() => {
    if (!selectedProfile) return;

    const loadStats = async () => {
      const newStats: Record<string, M3UStats> = {};

      for (const uuid of selectedProfile.m3uRefs) {
        try {
          const stats = await fileSystem.readJSONOrDefault<M3UStats | null>(getM3UStats(uuid), null);
          if (stats) {
            newStats[uuid] = stats;
          }
        } catch (error) {
          console.error(`Failed to load stats for ${uuid}:`, error);
        }
      }

      setStatsMap(newStats);
    };

    loadStats();
  }, [selectedProfile]);

  // Set initial selected profile
  useEffect(() => {
    if (!selectedProfileUsername && sortedProfiles.length > 0) {
      setSelectedProfileUsername(currentUsername || sortedProfiles[0].username);
    }
  }, [sortedProfiles, currentUsername, selectedProfileUsername]);

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;

    try {
      if (sourceType === 'url') {
        if (!newUrl.trim()) return;
        await createProfile(newUsername.trim());
        const uuid = await addM3UToProfile(newUsername.trim(), newUrl.trim());
        await selectProfile(newUsername.trim(), uuid);
      } else {
        const result = await createProfileFromFile(newUsername.trim());
        if (result) {
          await selectProfile(result.username, result.uuid);
        }
      }
      resetForm();
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  };

  const handleAddM3U = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProfile && newM3UUrl.trim()) {
      try {
        await addM3UToProfile(selectedProfile.username, newM3UUrl.trim());
        setNewM3UUrl('');
        setShowAddM3UForm(false);
      } catch (error) {
        console.error('Failed to add M3U:', error);
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === 'profile' && itemToDelete.username) {
        await deleteProfile(itemToDelete.username);
        if (selectedProfileUsername === itemToDelete.username) {
          setSelectedProfileUsername(null);
        }
      } else if (itemToDelete.type === 'm3u' && itemToDelete.username && itemToDelete.uuid) {
        await removeM3UFromProfile(itemToDelete.username, itemToDelete.uuid);
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const resetForm = () => {
    setShowAddForm(false);
    setNewUrl('');
    setNewUsername('');
    setSourceType('url');
  };

  const getM3UDisplayName = (uuid: string): string => {
    const url = getUrlFromUUID(uuid);
    if (!url) return uuid.slice(0, 8);

    if (url.startsWith('file://')) {
      const path = url.replace('file://', '');
      return path.split(/[/\\]/).pop() || uuid.slice(0, 8);
    }

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      return filename || urlObj.hostname;
    } catch {
      return url.slice(0, 30) + (url.length > 30 ? '...' : '');
    }
  };

  const renderStats = (uuid: string) => {
    const stats = statsMap[uuid];
    if (!stats) {
      return <span className="text-xs text-muted-foreground">No stats available</span>;
    }

    return (
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Film className="w-3 h-3" />
          {stats.movieCount} movies
        </span>
        <span className="flex items-center gap-1">
          <Tv className="w-3 h-3" />
          {stats.tvShowCount} series
        </span>
        <span className="flex items-center gap-1">
          <Radio className="w-3 h-3" />
          {stats.liveStreamCount} live
        </span>
      </div>
    );
  };

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary" aria-label="Manage profiles">
            <User className="w-4 h-4 mr-2" />
            Profiles
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col" aria-describedby=''>
          <DialogHeader>
            <DialogTitle>Profile Manager</DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex gap-4 overflow-hidden min-h-[400px]">
            {/* Left Panel - Profiles List */}
            <div className="w-64 flex flex-col border-r pr-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">Profiles</h3>
                <Button
                  onClick={() => setShowAddForm(true)}
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Add profile"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1">
                {sortedProfiles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No profiles</p>
                  </div>
                ) : (
                  sortedProfiles.map((profile) => (
                    <button
                      key={profile.username}
                      onClick={() => setSelectedProfileUsername(profile.username)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md transition-colors",
                        "hover:bg-accent",
                        selectedProfile?.username === profile.username && "bg-accent",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate flex-1">{profile.username}</span>
                        {currentUsername === profile.username && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {profile.m3uRefs.length} source{profile.m3uRefs.length !== 1 ? 's' : ''}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Right Panel - M3U Sources */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {showAddForm ? (
                /* Add Profile Form */
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-4">Add New Profile</h3>
                    <form onSubmit={handleSubmitProfile} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="e.g., john_doe"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Source Type</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={sourceType === 'url' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSourceType('url')}
                            className="flex-1"
                          >
                            URL
                          </Button>
                          <Button
                            type="button"
                            variant={sourceType === 'file' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSourceType('file')}
                            className="flex-1"
                          >
                            <FolderOpen className="w-4 h-4 mr-1" />
                            File
                          </Button>
                        </div>
                      </div>

                      {sourceType === 'url' && (
                        <div className="space-y-2">
                          <Label htmlFor="m3u-url">M3U URL</Label>
                          <Input
                            id="m3u-url"
                            type="url"
                            value={newUrl}
                            onChange={(e) => setNewUrl(e.target.value)}
                            placeholder="https://example.com/playlist.m3u"
                            className="font-mono text-sm"
                            required
                          />
                        </div>
                      )}

                      {sourceType === 'file' && (
                        <p className="text-sm text-muted-foreground">
                          Click "Create" to select an M3U file from your computer.
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Button type="submit" className="flex-1">
                          Create Profile
                        </Button>
                        <Button type="button" variant="outline" onClick={resetForm}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : selectedProfile ? (
                /* Selected Profile's M3U Sources */
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium">{selectedProfile.username}</h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedProfile.m3uRefs.length} M3U source{selectedProfile.m3uRefs.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {currentUsername !== selectedProfile.username && (
                        <Button
                          onClick={() => selectProfile(selectedProfile.username)}
                          variant="outline"
                          size="sm"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Activate
                        </Button>
                      )}
                      <Button
                        onClick={() => {
                          setItemToDelete({ type: 'profile', username: selectedProfile.username });
                          setDeleteDialogOpen(true);
                        }}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Delete profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2">
                    {selectedProfile.m3uRefs.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Tv className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No M3U sources</p>
                        <p className="text-sm">Add an M3U source to get started</p>
                      </div>
                    ) : (
                      selectedProfile.m3uRefs.map((uuid) => (
                        <Card
                          key={uuid}
                          className={cn(
                            "cursor-pointer transition-colors",
                            currentUUID === uuid && currentUsername === selectedProfile.username
                              ? "border-primary bg-primary/5"
                              : "hover:border-muted-foreground/50"
                          )}
                          onClick={() => selectProfile(selectedProfile.username, uuid)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {getM3UDisplayName(uuid)}
                                </p>
                                <div className="mt-1">
                                  {renderStats(uuid)}
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (currentUUID === uuid) {
                                      update();
                                    } else {
                                      selectProfile(selectedProfile.username, uuid).then(() => update());
                                    }
                                  }}
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Sync M3U"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </Button>

                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setItemToDelete({ type: 'm3u', username: selectedProfile.username, uuid });
                                    setDeleteDialogOpen(true);
                                  }}
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Remove M3U"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}

                    {/* Add M3U Form */}
                    {showAddM3UForm ? (
                      <Card>
                        <CardContent className="p-3">
                          <form onSubmit={handleAddM3U} className="space-y-2">
                            <Input
                              type="url"
                              value={newM3UUrl}
                              onChange={(e) => setNewM3UUrl(e.target.value)}
                              placeholder="https://example.com/playlist.m3u"
                              className="font-mono text-sm"
                              required
                            />
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" className="flex-1">
                                Add
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setShowAddM3UForm(false);
                                  setNewM3UUrl('');
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </CardContent>
                      </Card>
                    ) : (
                      <Button
                        onClick={() => setShowAddM3UForm(true)}
                        variant="outline"
                        className="w-full border-dashed"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add M3U Source
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                /* No Profile Selected */
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Select a profile or create a new one</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === 'profile'
                ? `This will permanently delete the profile "${itemToDelete.username}" and all its data.`
                : 'This will remove the M3U source from this profile.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
