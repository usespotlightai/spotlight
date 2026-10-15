import { ShieldCheck } from 'lucide-react';
import { SetCaveats } from '@/components/features/insights/candidates/SetCaveats';
import { Noted } from '@/components/shared/Noted';
import { Pill } from '@/components/shared/Pill';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type CandidatesSet, tasksShown } from '@/lib/insights-candidates';
import { type ReplayedStation, replaySetPath } from '@/lib/replay';

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
          {set.name}
        </TrailLink>
        <span className="text-muted-foreground text-xs">
          {set.health.tasks === 0
            ? 'No tasks yet'
            : tasksShown(set.health.tasks, set.health.runs)}
        </span>
        <SetCaveats health={set.health} minGain={set.health.minGain} />
        {set.guardsChanges && (
          <Noted note="Checks pull requests. If a pull request changes this station’s config, Spotlight replays it on this set. The pull request passes only if it does at least as well as the live config.">
            <span
              role="img"
              aria-label="Checks pull requests"
              className="inline-flex text-muted-foreground"
            >
              <ShieldCheck aria-hidden className="size-3.5" />
            </span>
          </Noted>
        )}
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
