import { type SubmitEvent, useState } from 'react';

import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type SendBackDialogProps = {
  station: string | null;
  onOpenChange: (open: boolean) => void;
  onSend: (reason: string) => void;
};

export function SendBackDialog({
  station,
  onOpenChange,
  onSend,
}: SendBackDialogProps) {
  const [reason, setReason] = useState('');

  const submit = (event?: SubmitEvent) => {
    event?.preventDefault();
    onSend(reason.trim());
    setReason('');
  };

  return (
    <Dialog open={station !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send it back to {station}</DialogTitle>
          <DialogDescription>
            The task leaves its station and {station} works on it again. The
            next run reads your reason.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <AutoGrowTextarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                submit();
              }
            }}
            placeholder="Say what to change…"
            aria-label="Reason"
            className="max-h-60 min-h-16 rounded-md border border-border px-3 py-2 text-foreground text-sm leading-5"
          />

          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Send back
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
