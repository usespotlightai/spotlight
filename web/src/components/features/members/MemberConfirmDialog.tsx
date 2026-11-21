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
import type { MemberChange } from '@/lib/members';

const CLOSING_MS = 150;

const WORDING: Record<
  MemberChange,
  {
    title: (name: string) => string;
    description: string;
    confirm: string;
    busy: string;
    destructive: boolean;
  }
> = {
  suspend: {
    title: (name) => `Suspend ${name}?`,
    description:
      'They lose access to the workspace at once. They stay in the members list with their teams and their work, and you can unsuspend them later.',
    confirm: 'Suspend',
    busy: 'Suspending…',
    destructive: true,
  },
  unsuspend: {
    title: (name) => `Unsuspend ${name}?`,
    description: 'They get back their role, their teams and their access.',
    confirm: 'Unsuspend',
    busy: 'Unsuspending…',
    destructive: false,
  },
  leave: {
    title: () => 'Leave this workspace?',
    description:
      'You lose access at once. You stay in the members list, and an admin or an owner can let you back in.',
    confirm: 'Leave workspace',
    busy: 'Leaving…',
    destructive: true,
  },
};

type MemberConfirmDialogProps = {
  change: MemberChange | null;
  name: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function MemberConfirmDialog({
  change,
  name,
  pending,
  error,
  onConfirm,
  onClose,
}: MemberConfirmDialogProps) {
  const shown = useDelayedValue(change, CLOSING_MS);
  const wording = shown ? WORDING[shown] : null;

  return (
    <Dialog open={change !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{wording?.title(name)}</DialogTitle>
          <DialogDescription>{wording?.description}</DialogDescription>
        </DialogHeader>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" />}>
            Cancel
          </DialogClose>
          <Button
            variant={wording?.destructive ? 'destructive' : 'default'}
            size="sm"
            disabled={!change || pending}
            onClick={onConfirm}
          >
            {pending ? wording?.busy : wording?.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
