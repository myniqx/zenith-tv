import { useState, useEffect, useMemo, useRef } from 'react';
import { useProfilesStore } from '@/stores/profiles';
import { useContentStore } from '@/stores/content';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@zenith-tv/ui/dialog';
import { Button } from '@zenith-tv/ui/button';
import { User } from 'lucide-react';
import { ProfileList } from './ProfileList';
import { M3USourceList } from './M3USourceList';
import { AddProfileForm } from './AddProfileForm';
import { DeleteDialog } from './DeleteDialog';
import { StatusBar } from './StatusBar';
import type { DeleteItem } from './types';

interface ProfileManagerProps {
  initialOpen?: boolean;
}

export function ProfileManager({ initialOpen = false }: ProfileManagerProps) {
  const profiles = useProfilesStore(s => s.profiles);
  const getCurrentUsername = useProfilesStore(s => s.getCurrentUsername);
  const currentUsername = getCurrentUsername();

  const statusMessage = useContentStore(s => s.statusMessage);
  const isLocked = statusMessage.status === 'loading' && statusMessage.percent !== null;

  const [open, setOpen] = useState(initialOpen);
  const [selectedProfileUsername, setSelectedProfileUsername] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteItem, setDeleteItem] = useState<DeleteItem | null>(null);

  // Tracks whether a card click triggered a load — if so, close on ready
  const pendingClose = useRef(false);

  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));
  }, [profiles]);

  useEffect(() => {
    if (!selectedProfileUsername && sortedProfiles.length > 0) {
      setSelectedProfileUsername(currentUsername || sortedProfiles[0].username);
    }
  }, [sortedProfiles, currentUsername, selectedProfileUsername]);

  useEffect(() => {
    if (pendingClose.current && statusMessage.status === 'ready') {
      pendingClose.current = false;
      setOpen(false);
    }
    if (pendingClose.current && statusMessage.status === 'error') {
      pendingClose.current = false;
    }
  }, [statusMessage.status]);

  const handleCardSelect = () => {
    pendingClose.current = true;
  };

  const handleDeleteClose = (deletedUsername?: string) => {
    if (deletedUsername && selectedProfileUsername === deletedUsername) {
      setSelectedProfileUsername(null);
    }
    setDeleteItem(null);
  };

  const rightPanel = () => {
    if (showAddForm) {
      return <AddProfileForm onDone={() => setShowAddForm(false)} />;
    }
    if (selectedProfileUsername) {
      return (
        <M3USourceList
          selectedProfileUsername={selectedProfileUsername}
          onDeleteRequest={setDeleteItem}
          onCardSelect={handleCardSelect}
        />
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Select a profile or create a new one</p>
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!isLocked) setOpen(v); }}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-none h-full px-4"
            aria-label="Manage profiles"
          >
            <User className="w-4 h-4" />
            Profiles
          </Button>
        </DialogTrigger>
        <DialogContent
          className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
          aria-describedby=""
          onInteractOutside={(e) => { if (isLocked) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (isLocked) e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle>Profile Manager</DialogTitle>
          </DialogHeader>

          <StatusBar />

          <div className={isLocked ? 'flex-1 flex gap-4 overflow-hidden min-h-[400px] pointer-events-none select-none opacity-60' : 'flex-1 flex gap-4 overflow-hidden min-h-[400px]'}>
            <ProfileList
              selectedProfileUsername={selectedProfileUsername}
              onSelectProfile={setSelectedProfileUsername}
              onAddProfile={() => setShowAddForm(true)}
            />
            {rightPanel()}
          </div>
        </DialogContent>
      </Dialog>

      <DeleteDialog item={deleteItem} onClose={handleDeleteClose} />
    </>
  );
}
