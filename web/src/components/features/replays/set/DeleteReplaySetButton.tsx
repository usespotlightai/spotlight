import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
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
  const [open, setOpen] = useState(false);
  const deleting = useDeleteReplaySet();
  const navigate = useNavigate();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full bg-card shadow-none"
        disabled={refusedBecause !== null}
        title={refusedBecause ?? undefined}
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
        Delete
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={(settled) => !settled && deleting.reset()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {set.name}?</DialogTitle>
            <DialogDescription>
              Deletes its replays and results. Its runs’ starting workspaces are
              no longer kept. This can’t be undone.
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
    </>
  );
}
