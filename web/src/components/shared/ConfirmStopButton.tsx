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
import { cn } from '@/lib/utils';

type ConfirmStopButtonProps = {
  title: string;
  description: string;
  keep: string;
  stop: string;
  pending: boolean;
  error: string | null;
  onStop: (stopped: () => void) => void;
  onClosed: () => void;
  className?: string;
};

export function ConfirmStopButton({
  title,
  description,
  keep,
  stop,
  pending,
  error,
  onStop,
  onClosed,
  className,
}: ConfirmStopButtonProps) {
  const [open, setOpen] = useState(false);

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
        onOpenChangeComplete={(settled) => !settled && onClosed()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {error && (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {keep}
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => onStop(() => setOpen(false))}
            >
              {pending ? 'Stopping…' : stop}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
