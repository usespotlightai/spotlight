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
        onOpenChangeComplete={(open) => !open && onClosed()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

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
