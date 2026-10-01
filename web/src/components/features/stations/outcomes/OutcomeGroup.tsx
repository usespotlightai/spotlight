import { Settings2 } from 'lucide-react';
import { ConfigChanges } from '@/components/features/stations/ConfigChanges';
import { OutcomeRow } from '@/components/features/stations/outcomes/OutcomeRow';
import { StationTallyFigures } from '@/components/features/stations/outcomes/StationTallyFigures';
import { Fingerprint } from '@/components/shared/Fingerprint';
import { runPath } from '@/lib/run';
import type { FingerprintGroup } from '@/lib/station-outcomes';

type OutcomeGroupProps = {
  slug: string;
  teamId: string;
  group: FingerprintGroup;
};

export function OutcomeGroup({ slug, teamId, group }: OutcomeGroupProps) {
  return (
    <li
      data-slot="config-group"
      className="flex flex-col rounded-xl border border-border bg-card"
    >
      <div className="flex flex-col gap-1.5 px-3 pt-2.5 pb-2">
        <p className="flex min-w-0 items-center gap-1.5 text-xs">
          <Settings2 className="size-3.5 text-muted-foreground" aria-hidden />
          {group.fingerprint ? (
            <>
              <span className="font-medium text-foreground">Config</span>
              <Fingerprint
                fingerprint={group.fingerprint}
                className="text-muted-foreground"
              />
            </>
          ) : (
            <span className="font-medium text-foreground">
              Before configs were recorded
            </span>
          )}
        </p>

        <ConfigChanges changes={group.changes} />

        <StationTallyFigures tally={group.tally} />
      </div>

      <ul
        aria-label="Runs"
        className="flex flex-col border-border border-t p-1"
      >
        {group.runs.map((run) => (
          <OutcomeRow
            key={run.runId}
            run={run}
            to={runPath(slug, teamId, run.runId)}
          />
        ))}
      </ul>
    </li>
  );
}
