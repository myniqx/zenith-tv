import { useState } from 'react';
import { useProfilesStore } from '../stores/profiles';
import { Button } from '@zenith-tv/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@zenith-tv/ui/dialog';
import { Input } from '@zenith-tv/ui/input';
import { Label } from '@zenith-tv/ui/label';
import { Card, CardContent, CardHeader } from '@zenith-tv/ui/card';
import { Badge } from '@zenith-tv/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@zenith-tv/ui/alert-dialog';
import { Separator } from '@zenith-tv/ui/separator';
import { X, Plus, FileUp, Check, Trash2, RefreshCw, Tv, User } from 'lucide-react';
import { useContentStore } from '@/stores/content';



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
  } = useProfilesStore();

  const update = useContentStore(s => s.update);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddM3UForm, setShowAddM3UForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newM3UUrl, setNewM3UUrl] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'profile' | 'm3u'; username?: string; uuid?: string } | null>(null);

  const currentUsername = getCurrentUsername();
  const currentUUID = getCurrentUUID();

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUrl.trim() && newUsername.trim()) {
      try {
        await createProfile(newUsername.trim());
        const uuid = await addM3UToProfile(newUsername.trim(), newUrl.trim());
        await selectProfile(newUsername.trim(), uuid);
        setNewUrl('');
        setNewUsername('');
        setShowAddForm(false);
      } catch (error) {
        console.error('Failed to create profile:', error);
      }
    }
  };

  const handleAddM3U = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUsername && newM3UUrl.trim()) {
      try {
        await addM3UToProfile(currentUsername, newM3UUrl.trim());
        setNewM3UUrl('');
        setShowAddM3UForm(false);
      } catch (error) {
        console.error('Failed to add M3U:', error);
      }
    }
  };

  const handleAddProfileFromFile = async () => {
    try {
      const result = await createProfileFromFile();
      if (result) {
        await selectProfile(result.username, result.uuid);
      }
    } catch (error) {
      console.error('Failed to import profile from file:', error);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === 'profile' && itemToDelete.username) {
        await deleteProfile(itemToDelete.username);
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

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="secondary"
            aria-label="Manage profiles"
          >
            <User className="w-4 h-4 mr-2" />
            Profiles
          </Button>
        </DialogTrigger>
        <DialogContent
          className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
          aria-describedby=''
        >
          <DialogHeader>
            <DialogTitle>Profile Manager</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Add Profile Buttons */}
            {!showAddForm && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => setShowAddForm(true)}
                  variant="outline"
                  className="h-auto p-4 border-dashed"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Profile from URL
                </Button>

                <Button
                  onClick={handleAddProfileFromFile}
                  variant="outline"
                  className="h-auto p-4 border-dashed"
                >
                  <FileUp className="w-5 h-5 mr-2" />
                  Import from File
                </Button>
              </div>
            )}

            {/* Add Profile Form */}
            {showAddForm && (
              <Card>
                <CardHeader>
                  <DialogTitle>Add New Profile</DialogTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitProfile} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username (unique identifier)</Label>
                      <Input
                        id="username"
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="e.g., john_doe or my-iptv"
                        required
                      />
                    </div>

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

                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1">
                        Create Profile
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowAddForm(false);
                          setNewUrl('');
                          setNewUsername('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Profiles List */}
            {profiles.length === 0 ? (
              <div className="text-center py-12">
                <Tv className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No profiles yet</h3>
                <p className="text-muted-foreground">
                  Add your first M3U playlist to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {profiles.map((profile) => (
                  <Card
                    key={profile.username}
                    className={currentUsername === profile.username ? 'border-primary' : ''}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg">{profile.username}</h3>
                            {currentUsername === profile.username && (
                              <Badge>Active</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {profile.m3uRefs.length} M3U source{profile.m3uRefs.length !== 1 ? 's' : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            onClick={() => selectProfile(profile.username)}
                            variant="ghost"
                            size="icon"
                            title="Select profile"
                          >
                            <Check className="w-5 h-5" />
                          </Button>

                          <Button
                            onClick={() => {
                              setItemToDelete({ type: 'profile', username: profile.username });
                              setDeleteDialogOpen(true);
                            }}
                            variant="ghost"
                            size="icon"
                            title="Delete profile"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {/* M3U List for this profile */}
                    {currentUsername === profile.username && profile.m3uRefs.length > 0 && (
                      <CardContent className="pt-0">
                        <Separator className="mb-4" />
                        <div className="space-y-2">
                          {profile.m3uRefs.map((uuid) => (
                            <Card
                              key={uuid}
                              className={`cursor-pointer transition-colors ${currentUUID === uuid
                                ? 'border-primary bg-primary/5'
                                : 'hover:border-muted-foreground/50'
                                }`}
                              onClick={() => selectProfile(profile.username, uuid)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-mono truncate">
                                      UUID: {uuid}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1">
                                      <span className="text-xs text-muted-foreground">M3U Source</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 ml-2">
                                    <Button
                                      onClick={() => update()}
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
                                        setItemToDelete({ type: 'm3u', username: profile.username, uuid });
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
                          ))}

                          {/* Add M3U Button */}
                          {!showAddM3UForm && (
                            <Button
                              onClick={() => setShowAddM3UForm(true)}
                              variant="outline"
                              className="w-full border-dashed"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Another M3U
                            </Button>
                          )}

                          {/* Add M3U Form */}
                          {showAddM3UForm && (
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
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
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
