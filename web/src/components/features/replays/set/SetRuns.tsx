import { History } from 'lucide-react';
import { CardList } from '@/components/features/replays/CardList';
import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { StateBox } from '@/components/features/replays/StateBox';
import { AddRunsButton } from '@/components/features/replays/set/AddRunsButton';
import { SetRunRow } from '@/components/features/replays/set/SetRunRow';
import { EmptyState } from '@/components/shared/EmptyState';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';

type SetRunsProps = {
  at: ReplayedStation;
  set: ReplaySet;
  frozen: boolean;
};

export function SetRuns({ at, set, frozen }: SetRunsProps) {
  const add = set.stationGone ? undefined : (
    <AddRunsButton at={at} set={set} disabled={frozen} />
  );

  return (
    <section aria-labelledby="set-runs" className="flex flex-col gap-2">
      <ReplaysHeading
        title="Runs"
        id="set-runs"
        level="h2"
        action={set.entries.length > 0 ? add : undefined}
      />

      {set.entries.length === 0 ? (
        <StateBox>
          <EmptyState icon={History} title="No runs in this set" action={add}>
            Pick past runs of the station to replay. A run can be replayed when
            Spotlight kept where it started.
          </EmptyState>
        </StateBox>
      ) : (
        <CardList label="Runs in the set">
          {set.entries.map((entry) => (
            <SetRunRow
              key={entry.runId}
              at={at}
              setId={set.id}
              entry={entry}
              frozen={frozen}
            />
          ))}
        </CardList>
      )}
    </section>
  );
}
