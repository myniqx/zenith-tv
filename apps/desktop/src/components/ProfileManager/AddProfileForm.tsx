import { useState } from 'react';
import { useProfilesStore } from '@/stores/profiles';
import { Button } from '@zenith-tv/ui/button';
import { Input } from '@zenith-tv/ui/input';
import { Label } from '@zenith-tv/ui/label';
import { Card, CardContent } from '@zenith-tv/ui/card';
import { AlertCircle, FolderOpen } from 'lucide-react';
import type { SourceType } from './types';

interface AddProfileFormProps {
  onDone: () => void;
}

export function AddProfileForm({ onDone }: AddProfileFormProps) {
  const createProfile = useProfilesStore(s => s.createProfile);
  const createProfileFromFile = useProfilesStore(s => s.createProfileFromFile);
  const addM3UToProfile = useProfilesStore(s => s.addM3UToProfile);
  const selectProfile = useProfilesStore(s => s.selectProfile);

  const [sourceType, setSourceType] = useState<SourceType>('url');
  const [username, setUsername] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setError(null);

    try {
      if (sourceType === 'url') {
        if (!url.trim()) return;
        createProfile(username.trim());
        const uuid = addM3UToProfile(username.trim(), url.trim());
        await selectProfile(username.trim(), uuid);
      } else {
        const result = await createProfileFromFile(username.trim());
        if (result) {
          await selectProfile(result.username, result.uuid);
        }
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    }
  };

  return (
    <Card className="flex-1 overflow-auto">
      <CardContent className="p-4">
        <h3 className="font-medium mb-4">Add New Profile</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
                value={url}
                onChange={(e) => setUrl(e.target.value)}
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

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Create Profile
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
