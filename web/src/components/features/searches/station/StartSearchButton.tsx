import { StartSearchDialog } from '@/components/features/searches/station/StartSearchDialog';
import { DialogButton } from '@/components/shared/DialogButton';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';

type StartSearchButtonProps = {
  at: ReplayedStation;
  sets: readonly ReplaySet[];
  refusedBecause: string | null;
};

export function StartSearchButton({
  at,
  sets,
  refusedBecause,
}: StartSearchButtonProps) {
  return (
    <DialogButton
      label="Start a search"
      variant="outline"
      refusedBecause={refusedBecause}
      dialog={(open, onOpenChange) => (
        <StartSearchDialog
          at={at}
          sets={sets}
          open={open}
          onOpenChange={onOpenChange}
        />
      )}
    />
  );
}
