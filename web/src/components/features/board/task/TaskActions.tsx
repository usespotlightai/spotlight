import { MoreHorizontal, Trash } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type TaskActionsProps = {
  title: string;
  onDelete: () => void;
};

export function TaskActions({ title, onDelete }: TaskActionsProps) {
  const [asking, setAsking] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Task options"
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-foreground/10 hover:text-foreground data-[popup-open]:bg-foreground/10 data-[popup-open]:text-foreground"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" sideOffset={6} className="min-w-44">
          <DropdownMenuItem closeOnClick onClick={() => setAsking(true)}>
            <Trash className="size-3.5" aria-hidden />
            Delete task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{title}"?</DialogTitle>
          </DialogHeader>

          <p className="text-muted-foreground text-sm">
            Station notes on this task are deleted too. This can’t be undone.
          </p>

          <DialogFooter className="sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAsking(false)}
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
            >
              Delete task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
