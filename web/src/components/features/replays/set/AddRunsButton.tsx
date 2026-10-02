import { Plus } from 'lucide-react';
import { useState } from 'react';
import { AddRunsDialog } from '@/components/features/replays/set/AddRunsDialog';
import { Button } from '@/components/ui/button';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';

type AddRunsButtonProps = {
  at: ReplayedStation;
  set: ReplaySet;
  disabled?: boolean;
};

export function AddRunsButton({
  at,
  set,
  disabled = false,
}: AddRunsButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full bg-card shadow-none"
        disabled={disabled}
        title={
          disabled ? 'The set is frozen while a search of it runs' : undefined
        }
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden />
        Add runs
      </Button>

      <AddRunsDialog at={at} set={set} open={open} onOpenChange={setOpen} />
    </>
  );
}
