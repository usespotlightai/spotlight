import { DeleteReplaySetButton } from '@/components/features/replays/set/DeleteReplaySetButton';
import { RenameReplaySetButton } from '@/components/features/replays/set/RenameReplaySetButton';
import type { ReplaySet } from '@/lib/replay';

const UNDELETABLE =
  'A replay or search of this set is running. Delete it once that ends or is stopped.';

type ReplaySetActionsProps = {
  teamId: string;
  set: ReplaySet;
  running: boolean;
  deletedTo: string;
};

export function ReplaySetActions({
  teamId,
  set,
  running,
  deletedTo,
}: ReplaySetActionsProps) {
  return (
    <>
      <RenameReplaySetButton teamId={teamId} set={set} />
      <DeleteReplaySetButton
        teamId={teamId}
        set={set}
        refusedBecause={running ? UNDELETABLE : null}
        deletedTo={deletedTo}
      />
    </>
  );
}
