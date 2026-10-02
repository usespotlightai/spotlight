import { DeleteReplaySetButton } from '@/components/features/replays/set/DeleteReplaySetButton';
import { GuardsChangesToggle } from '@/components/features/replays/set/GuardsChangesToggle';
import { RenameReplaySetButton } from '@/components/features/replays/set/RenameReplaySetButton';
import { anyUnderway, type Replay, type ReplaySet } from '@/lib/replay';
import { since } from '@/lib/runner';
import type { LineReplayCheck } from '@/lib/search';

const UNDELETABLE =
  'A replay or search of this set is running, so it can’t be deleted until that ends or is stopped.';

const FROZEN =
  'A search of this set is under way, so its runs stay as they are until the search ends or is stopped.';

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
          Its station is gone from its line, so it starts no replays, takes no
          more runs and keeps none of its runs’ workspaces. It can still be
          renamed, have runs taken out, or be deleted.
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
