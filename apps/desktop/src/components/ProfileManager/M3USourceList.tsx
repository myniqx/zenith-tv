import { useState } from 'react';
import { useProfilesStore } from '@/stores/profiles';
import { Button } from '@zenith-tv/ui/button';
import { Check, Trash2, Tv, Plus } from 'lucide-react';
import { M3USourceCard } from './M3USourceCard';
import { AddM3UForm } from './AddM3UForm';
import type { DeleteItem } from './types';

interface M3USourceListProps {
  selectedProfileUsername: string;
  onDeleteRequest: (item: DeleteItem) => void;
  onCardSelect: () => void;
}

export function M3USourceList({ selectedProfileUsername, onDeleteRequest, onCardSelect }: M3USourceListProps) {
  const profiles = useProfilesStore(s => s.profiles);
  const selectProfile = useProfilesStore(s => s.selectProfile);
  const getCurrentUsername = useProfilesStore(s => s.getCurrentUsername);

  const currentUsername = getCurrentUsername();
  const profile = profiles.find(p => p.username === selectedProfileUsername);

  const [showAddForm, setShowAddForm] = useState(false);

  if (!profile) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-medium">{profile.username}</h3>
          <p className="text-xs text-muted-foreground">
            {profile.m3uRefs.length} M3U source{profile.m3uRefs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-1">
          {currentUsername !== profile.username && (
            <Button
              onClick={() => selectProfile(profile.username)}
              variant="outline"
              size="sm"
            >
              <Check className="w-4 h-4 mr-1" />
              Activate
            </Button>
          )}
          <Button
            onClick={() => onDeleteRequest({ type: 'profile', username: profile.username })}
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
        {profile.m3uRefs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Tv className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No M3U sources</p>
            <p className="text-sm">Add an M3U source to get started</p>
          </div>
        ) : (
          profile.m3uRefs.map((uuid) => (
            <M3USourceCard
              key={uuid}
              uuid={uuid}
              profileUsername={profile.username}
              onDelete={() => onDeleteRequest({ type: 'm3u', username: profile.username, uuid })}
              onSelect={onCardSelect}
            />
          ))
        )}

        {showAddForm ? (
          <AddM3UForm
            profileUsername={profile.username}
            onDone={() => setShowAddForm(false)}
          />
        ) : (
          <Button
            onClick={() => setShowAddForm(true)}
            variant="outline"
            className="w-full border-dashed"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add M3U Source
          </Button>
        )}
      </div>
    </div>
  );
}
