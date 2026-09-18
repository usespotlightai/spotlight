import { type FormEvent, useState } from 'react';
import { MoveConfigurationOutcome } from '@/components/features/settings/MoveConfigurationOutcome';
import { RepositoryField } from '@/components/shared/form/RepositoryField';
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
import { useMoveConfiguration } from '@/hooks/api/useMoveConfiguration';
import { fullNameOf } from '@/lib/repository';

type MoveConfigurationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string | undefined;
  teamId: string | undefined;
  owner: string | null;
};

export function MoveConfigurationDialog({
  open,
  onOpenChange,
  slug,
  teamId,
  owner,
}: MoveConfigurationDialogProps) {
  const move = useMoveConfiguration(teamId);
  const [named, setNamed] = useState('');

  const forget = () => {
    setNamed('');
    move.reset();
  };

  const fullName = fullNameOf(owner, named);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!fullName || move.isPending) {
      return;
    }
    move.mutate(fullName);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(settled) => !settled && forget()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move configuration</DialogTitle>
          <DialogDescription>
            This team’s current configuration is carried to the repository you
            choose in a pull request.
          </DialogDescription>
        </DialogHeader>

        {move.isSuccess && move.data ? (
          <MoveConfigurationOutcome
            moved={move.data}
            repository={move.variables}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <form onSubmit={submit} className="contents">
            <RepositoryField
              slug={slug}
              owner={owner}
              value={named}
              onChange={setNamed}
              disabled={move.isPending}
              autoFocus
            />

            {move.isError && (
              <p className="text-destructive text-xs">{move.error.message}</p>
            )}

            <DialogFooter>
              <DialogClose render={<Button variant="outline" size="sm" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                size="sm"
                disabled={move.isPending || !fullName}
              >
                {move.isPending ? 'Moving…' : 'Move'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
