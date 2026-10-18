import { Plus } from 'lucide-react';
import { AddRunsDialog } from '@/components/features/replays/set/AddRunsDialog';
import { DialogButton } from '@/components/shared/DialogButton';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';
import { RUNS_FROZEN_BY_SEARCH } from '@/lib/replay-words';

type AddRunsButtonProps = {
  at: ReplayedStation;
  set: ReplaySet;
  disabled: boolean;
};

export function AddRunsButton({ at, set, disabled }: AddRunsButtonProps) {
  return (
    <DialogButton
      label="Add runs"
      icon={Plus}
      variant="outline"
      disabledBecause={disabled ? RUNS_FROZEN_BY_SEARCH : null}
      dialog={(open, onOpenChange) => (
        <AddRunsDialog
          at={at}
          set={set}
          open={open}
          onOpenChange={onOpenChange}
        />
      )}
    />
  );
}
