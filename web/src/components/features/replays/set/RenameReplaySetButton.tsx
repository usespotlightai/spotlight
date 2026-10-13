import { Pencil } from 'lucide-react';
import { ReplaySetNameDialog } from '@/components/features/replays/ReplaySetNameDialog';
import { DialogButton } from '@/components/shared/DialogButton';
import { useRenameReplaySet } from '@/hooks/api/useRenameReplaySet';
import type { ReplaySet } from '@/lib/replay';

type RenameReplaySetButtonProps = {
  teamId: string;
  set: ReplaySet;
};

export function RenameReplaySetButton({
  teamId,
  set,
}: RenameReplaySetButtonProps) {
  const rename = useRenameReplaySet();

  return (
    <DialogButton
      label="Rename"
      icon={Pencil}
      variant="outline"
      refusedBecause={null}
      dialog={(open, onOpenChange) => (
        <ReplaySetNameDialog
          key={set.name}
          open={open}
          onOpenChange={onOpenChange}
          title="Rename the replay set"
          description="Its runs and replays stay as they are."
          name={set.name}
          submit="Rename"
          submitting="Renaming…"
          pending={rename.isPending}
          onClosed={() => rename.reset()}
          onSubmit={(name) =>
            rename.mutate(
              { teamId, setId: set.id, name },
              { onSuccess: () => onOpenChange(false) },
            )
          }
        />
      )}
    />
  );
}
