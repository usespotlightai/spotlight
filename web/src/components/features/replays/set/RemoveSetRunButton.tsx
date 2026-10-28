import { X } from 'lucide-react';
import { useState } from 'react';
import { DisabledReasonTooltip } from '@/components/shared/DisabledReasonTooltip';
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
import { useRemoveReplaySetEntry } from '@/hooks/api/useRemoveReplaySetEntry';
import { messageOf } from '@/lib/error';
import type { ReplayedStation } from '@/lib/replay';
import {
  REMOVED_TASK_STAYS_OUT,
  RUNS_FROZEN_BY_SEARCH,
} from '@/lib/replay-words';

type RemoveSetRunButtonProps = {
  at: ReplayedStation;
  setId: string;
  runId: string;
  title: string;
  frozen: boolean;
};

export function RemoveSetRunButton({
  at,
  setId,
  runId,
  title,
  frozen,
}: RemoveSetRunButtonProps) {
  const remove = useRemoveReplaySetEntry();
  const [open, setOpen] = useState(false);

  return (
    <>
      <DisabledReasonTooltip reason={frozen ? RUNS_FROZEN_BY_SEARCH : null}>
        {(describedBy) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="opacity-0 focus-visible:opacity-100 group-hover/run:opacity-100"
            aria-label={`Take ${title} out of the set`}
            aria-describedby={describedBy}
            disabled={remove.isPending || frozen}
            onClick={() => setOpen(true)}
          >
            <X aria-hidden />
          </Button>
        )}
      </DisabledReasonTooltip>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={(open) => !open && remove.reset()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Take “{title}” out of the set?</DialogTitle>
            <DialogDescription>{REMOVED_TASK_STAYS_OUT}</DialogDescription>
          </DialogHeader>

          {remove.isError && (
            <p role="alert" className="text-destructive text-sm">
              {messageOf(
                remove.error,
                'Sorry, the run couldn’t be taken out. Please try again later.',
              )}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Keep it
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(
                  { teamId: at.teamId, setId, runId },
                  { onSuccess: () => setOpen(false) },
                )
              }
            >
              {remove.isPending ? 'Taking out…' : 'Take it out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
