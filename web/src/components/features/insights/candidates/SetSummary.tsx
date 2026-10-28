import { SetCaveats } from '@/components/features/insights/candidates/SetCaveats';
import { Pill } from '@/components/shared/Pill';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type CandidatesSet, formatTasks } from '@/lib/insights-candidates';
import { type ReplayedStation, replaySetPath } from '@/lib/replay';
import { REPLAY_SET_TITLE } from '@/lib/replay-words';

type SetSummaryProps = {
  at: ReplayedStation;
  set: CandidatesSet;
};

export function SetSummary({ at, set }: SetSummaryProps) {
  return (
    <div
      data-slot="replay-set-health"
      className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <TrailLink
          to={replaySetPath(at, set.setId)}
          className="min-w-0 truncate font-medium text-foreground text-xs underline-offset-2 hover:underline"
        >
          {REPLAY_SET_TITLE}
        </TrailLink>
        <span className="text-muted-foreground text-xs">
          {set.health.tasks === 0
            ? 'No tasks yet'
            : formatTasks(set.health.tasks, set.health.runs)}
        </span>
        <SetCaveats health={set.health} minGain={set.health.minGain} />
        {set.stationGone && <Pill>Station gone</Pill>}
      </div>

      {!set.baseline && (
        <p className="text-muted-foreground text-xs">
          The live config hasn’t been replayed on this set. Nothing is compared
          with live.
        </p>
      )}
    </div>
  );
}
