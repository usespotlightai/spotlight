import { LatestReplay } from '@/components/features/replays/station/LatestReplay';
import { Pill } from '@/components/shared/Pill';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  type ReplayedStation,
  type ReplaySet,
  replaySetPath,
} from '@/lib/replay';

type ReplaySetRowProps = {
  at: ReplayedStation;
  set: ReplaySet;
};

export function ReplaySetRow({ at, set }: ReplaySetRowProps) {
  const runs = set.entries.length;

  return (
    <li
      data-slot="replay-set"
      className="relative flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
    >
      <TrailLink
        to={replaySetPath(at, set.id)}
        className="min-w-0 truncate font-medium text-foreground outline-none after:absolute after:inset-0 after:rounded-md focus-visible:underline"
      >
        {set.name}
      </TrailLink>

      <span className="text-muted-foreground text-xs tabular-nums">
        {runs === 1 ? '1 run' : `${runs} runs`}
      </span>

      {set.stationGone && <Pill>Station gone</Pill>}

      <LatestReplay teamId={at.teamId} setId={set.id} className="sm:ml-auto" />
    </li>
  );
}
