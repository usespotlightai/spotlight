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
import { useDelayedValue } from '@/hooks/useDelayedValue';

const CLOSING_MS = 150;

type StoppingMove = {
  readonly title: string;
  readonly station: string;
};

type StopRunDialogProps = {
  move: StoppingMove | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function StopRunDialog({
  move,
  onConfirm,
  onClose,
}: StopRunDialogProps) {
  const shown = useDelayedValue(move, CLOSING_MS);

  return (
    <Dialog open={move !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Move "{shown?.title}" to {shown?.station}?
          </DialogTitle>
          <DialogDescription>
            An agent is working on this task. Spotlight stops the run, and the
            changes that the agent did not push are lost. You can’t undo this.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="sm:justify-end">
          <DialogClose render={<Button variant="outline" size="sm" />}>
            Keep it running
          </DialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={!move}
            onClick={onConfirm}
          >
            Stop run and move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
