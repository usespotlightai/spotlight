import { Square } from 'lucide-react';
import { useState } from 'react';
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
import { useStopReplay } from '@/hooks/api/useStopReplay';
import { messageOf } from '@/lib/error';
import { cn } from '@/lib/utils';

type StopReplayButtonProps = {
  teamId: string;
  replayId: string;
  className?: string;
};

export function StopReplayButton({
  teamId,
  replayId,
  className,
}: StopReplayButtonProps) {
  const [open, setOpen] = useState(false);
  const stop = useStopReplay();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('rounded-full bg-card shadow-none', className)}
        onClick={() => setOpen(true)}
      >
        <Square aria-hidden />
        Stop
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={(settled) => !settled && stop.reset()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop this replay?</DialogTitle>
            <DialogDescription>
              Nothing more of it starts, and its running runs are stopped. What
              has finished keeps its results.
            </DialogDescription>
          </DialogHeader>

          {stop.isError && (
            <p role="alert" className="text-destructive text-xs">
              {messageOf(stop.error, 'Could not stop the replay')}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Keep it running
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              disabled={stop.isPending}
              onClick={() =>
                stop.mutate(
                  { teamId, replayId },
                  { onSuccess: () => setOpen(false) },
                )
              }
            >
              {stop.isPending ? 'Stopping…' : 'Stop replay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
