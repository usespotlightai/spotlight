import { Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { DialogButton } from '@/components/shared/DialogButton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDeleteReplaySet } from '@/hooks/api/useDeleteReplaySet';
import type { ReplaySet } from '@/lib/replay';

type DeleteReplaySetButtonProps = {
  teamId: string;
  set: ReplaySet;
  refusedBecause: string | null;
  deletedTo: string;
};

export function DeleteReplaySetButton({
  teamId,
  set,
  refusedBecause,
  deletedTo,
}: DeleteReplaySetButtonProps) {
  const deleting = useDeleteReplaySet();
  const navigate = useNavigate();

  return (
    <DialogButton
      label="Delete"
      icon={Trash2}
      variant="outline"
      refusedBecause={refusedBecause}
      dialog={(open, onOpenChange) => (
        <Dialog
          open={open}
          onOpenChange={onOpenChange}
          onOpenChangeComplete={(settled) => !settled && deleting.reset()}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {set.name}?</DialogTitle>
              <DialogDescription>
                Deletes its replays and results. Its runs’ starting workspaces
                are no longer kept. This can’t be undone.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" size="sm" />}>
                Keep it
              </DialogClose>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleting.isPending}
                onClick={() =>
                  deleting.mutate(
                    { teamId, setId: set.id },
                    { onSuccess: () => navigate(deletedTo) },
                  )
                }
              >
                {deleting.isPending ? 'Deleting…' : 'Delete set'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    />
  );
}
