import { useState } from 'react';
import { useProfilesStore } from '@/stores/profiles';
import { useContentStore } from '@/stores/content';
import { Button } from '@zenith-tv/ui/button';
import { Input } from '@zenith-tv/ui/input';
import { Card, CardContent } from '@zenith-tv/ui/card';
import { AlertCircle } from 'lucide-react';

interface AddM3UFormProps {
  profileUsername: string;
  onDone: () => void;
}

export function AddM3UForm({ profileUsername, onDone }: AddM3UFormProps) {
  const addM3UToProfile = useProfilesStore(s => s.addM3UToProfile);
  const selectProfile = useProfilesStore(s => s.selectProfile);

  const update = useContentStore(s => s.update);

  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setError(null);

    try {
      const uuid = addM3UToProfile(profileUsername, url.trim());
      await selectProfile(profileUsername, uuid);
      await update();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add M3U');
    }
  };

  return (
    <Card>
      <CardContent className="p-3">
        <form onSubmit={handleSubmit} className="space-y-2">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/playlist.m3u"
            className="font-mono text-sm"
            required
            autoFocus
          />
          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1">
              Add
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
