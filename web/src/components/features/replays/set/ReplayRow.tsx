import { ReplayStatePill } from '@/components/features/replays/ReplayStatePill';
import { SuccessAgainstBaseline } from '@/components/features/replays/SuccessAgainstBaseline';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  candidateShown,
  type Replay,
  type ReplayedStation,
  replayPath,
  scoredShown,
  spendOfCeiling,
} from '@/lib/replay';
import { repeatsShown } from '@/lib/replay-words';
import { since } from '@/lib/since';

type ReplayRowProps = {
  at: ReplayedStation;
  replay: Replay;
  baseline: Replay | null;
};

export function ReplayRow({ at, replay, baseline }: ReplayRowProps) {
  return (
    <li
      data-slot="replay"
      className="relative flex flex-col gap-1 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <TrailLink
          to={replayPath(at, replay.id)}
          className="min-w-0 truncate font-medium text-foreground outline-none after:absolute after:inset-0 after:rounded-md focus-visible:underline"
        >
          {candidateShown(replay.candidate)}
        </TrailLink>
        {replay.isBaseline && (
          <span className="text-muted-foreground text-xs">Baseline</span>
        )}
        <ReplayStatePill state={replay.state} />
        <span className="text-muted-foreground text-xs sm:ml-auto">
          Started {since(replay.startedAt)}
        </span>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        <SuccessAgainstBaseline replay={replay} baseline={baseline} />
        <span className="text-muted-foreground tabular-nums">
          {scoredShown(replay.totals)}
        </span>
        <span className="text-muted-foreground tabular-nums">
          Spent {spendOfCeiling(replay.totals.spent, replay.ceiling)}
        </span>
        {replay.repeats > 1 && (
          <span className="text-muted-foreground">
            {repeatsShown(replay.repeats)}
          </span>
        )}
      </div>
    </li>
  );
}
