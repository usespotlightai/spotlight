import { ShieldCheck } from 'lucide-react';
import { HealthLines } from '@/components/features/replays/HealthLines';
import { Pill } from '@/components/shared/Pill';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type CandidatesSet, healthShown } from '@/lib/insights-candidates';
import { type ReplayedStation, replaySetPath } from '@/lib/replay';

type ReplaySetHealthProps = {
  at: ReplayedStation;
  set: CandidatesSet;
  now: Date;
};

export function ReplaySetHealth({ at, set, now }: ReplaySetHealthProps) {
  return (
    <div data-slot="replay-set-health" className="flex flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <TrailLink
          to={replaySetPath(at, set.setId)}
          className="min-w-0 truncate font-medium text-foreground text-xs underline-offset-2 hover:underline"
        >
          {set.name}
        </TrailLink>
        {set.guardsChanges && (
          <Pill lead={<ShieldCheck aria-hidden className="size-3" />}>
            Guards changes
          </Pill>
        )}
        {set.stationGone && <Pill>Station gone</Pill>}
      </div>
      <p className="text-muted-foreground text-xs">
        {healthShown(set.health, now)}
      </p>
      <HealthLines
        setName={set.name}
        health={set.health}
        minGain={set.health.minGain}
        compact
      />
      {!set.baseline && (
        <p className="text-muted-foreground text-xs">
          The live config was never replayed over it, so nothing is compared
          with live.
        </p>
      )}
    </div>
  );
}
