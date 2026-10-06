import { DeleteReplaySetButton } from '@/components/features/replays/set/DeleteReplaySetButton';
import { GuardsChangesToggle } from '@/components/features/replays/set/GuardsChangesToggle';
import { RenameReplaySetButton } from '@/components/features/replays/set/RenameReplaySetButton';
import { anyUnderway, type Replay, type ReplaySet } from '@/lib/replay';
import type { LineReplayCheck } from '@/lib/search';
import { since } from '@/lib/since';

const UNDELETABLE =
  'A replay or search of this set is running. Delete it once that ends or is stopped.';

const FROZEN =
  'A search of this set is underway. Its runs are frozen until the search ends or is stopped.';

type ReplaySetHeaderProps = {
  teamId: string;
  set: ReplaySet;
  replays: readonly Replay[];
  deletedTo: string;
  replayCheck: LineReplayCheck | null | undefined;
  searching: boolean;
};

export function ReplaySetHeader({
  teamId,
  set,
  replays,
  deletedTo,
  replayCheck,
  searching,
}: ReplaySetHeaderProps) {
  const runs = set.entries.length;
  const running = anyUnderway(replays) || searching;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-2">
        <h1 className="min-w-0 break-words font-semibold text-2xl text-foreground leading-8 tracking-tight">
          {set.name}
        </h1>

        <div className="ml-auto flex items-center gap-2">
          <RenameReplaySetButton teamId={teamId} set={set} />
          <DeleteReplaySetButton
            teamId={teamId}
            set={set}
            refusedBecause={running ? UNDELETABLE : null}
            deletedTo={deletedTo}
          />
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        {runs === 1 ? '1 run' : `${runs} runs`} · opened {since(set.createdAt)}
      </p>

      <GuardsChangesToggle
        teamId={teamId}
        set={set}
        replayCheck={replayCheck}
      />

      {set.stationGone && (
        <p
          role="note"
          className="rounded-lg border border-border bg-card px-3 py-2 text-muted-foreground text-sm"
        >
          Station is gone from its line. The set starts no replays, takes no
          runs and keeps no workspaces. You can still rename it, remove runs or
          delete it.
        </p>
      )}

      {running && (
        <p className="text-muted-foreground text-xs">{UNDELETABLE}</p>
      )}

      {searching && (
        <p role="note" className="text-muted-foreground text-xs">
          {FROZEN}
        </p>
      )}
    </div>
  );
}
