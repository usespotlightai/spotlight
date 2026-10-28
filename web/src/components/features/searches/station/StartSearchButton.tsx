import { StartSearchDialog } from '@/components/features/searches/station/StartSearchDialog';
import { DialogButton } from '@/components/shared/DialogButton';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';

type StartSearchButtonProps = {
  at: ReplayedStation;
  set: ReplaySet | null;
  disabledBecause: string | null;
};

export function StartSearchButton({
  at,
  set,
  disabledBecause,
}: StartSearchButtonProps) {
  return (
    <DialogButton
      label="Start a search"
      variant="outline"
      disabledBecause={disabledBecause}
      dialog={(open, onOpenChange) =>
        set && (
          <StartSearchDialog
            at={at}
            set={set}
            open={open}
            onOpenChange={onOpenChange}
          />
        )
      }
    />
  );
}
