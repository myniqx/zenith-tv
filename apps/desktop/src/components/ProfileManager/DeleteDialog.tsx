import { useProfilesStore } from '@/stores/profiles';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@zenith-tv/ui/alert-dialog';
import type { DeleteItem } from './types';

interface DeleteDialogProps {
  item: DeleteItem | null;
  onClose: (deletedUsername?: string) => void;
}

export function DeleteDialog({ item, onClose }: DeleteDialogProps) {
  const deleteProfile = useProfilesStore(s => s.deleteProfile);
  const removeM3UFromProfile = useProfilesStore(s => s.removeM3UFromProfile);

  const handleConfirm = async () => {
    if (!item) return;
    try {
      if (item.type === 'profile' && item.username) {
        await deleteProfile(item.username);
        onClose(item.username);
      } else if (item.type === 'm3u' && item.username && item.uuid) {
        await removeM3UFromProfile(item.username, item.uuid);
        onClose();
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      onClose();
    }
  };

  return (
    <AlertDialog open={!!item} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            {item?.type === 'profile'
              ? `This will permanently delete the profile "${item.username}" and all its data.`
              : 'This will remove the M3U source from this profile.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onClose()}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
