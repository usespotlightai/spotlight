import { type FormEvent, useState } from 'react';
import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MOST_RETIRE_REASON } from '@/lib/memory';

type RetireMemoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  failed: boolean;
  onRetire: (reason: string) => void;
};

export function RetireMemoryDialog({
  open,
  onOpenChange,
  pending,
  failed,
  onRetire,
}: RetireMemoryDialogProps) {
  const [reason, setReason] = useState('');
  const unretirable = !reason.trim() || pending;

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (!unretirable) {
      onRetire(reason.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-medium text-foreground text-sm">
            Retire this memory
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="contents">
          <p className="text-muted-foreground text-sm leading-6">
            Runs stop being told it. It stays here, under Retired, with your
            reason.
          </p>
          <AutoGrowTextarea
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why it no longer holds"
            aria-label="Why it no longer holds"
            maxLength={MOST_RETIRE_REASON}
            className="min-h-16 rounded-lg border border-border bg-muted/60 px-2 py-1.5 text-sm leading-6"
          />

          <DialogFooter className="items-center sm:justify-between">
            {failed ? (
              <p role="alert" className="text-destructive text-xs">
                It could not be retired. Try again.
              </p>
            ) : (
              <span />
            )}
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={unretirable}
            >
              Retire
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
