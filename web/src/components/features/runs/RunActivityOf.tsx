import { RunActivity } from '@/components/features/runs/RunActivity';
import type { RunJournal } from '@/lib/inbox';
import { type Run, workOf } from '@/lib/run';

type RunActivityOfProps = {
  run: Pick<Run, 'id' | 'state'>;
  stopping: boolean;
  journals: readonly RunJournal[];
  station: NonNullable<Run['station']>;
};

export function RunActivityOf({
  run,
  stopping,
  journals,
  station,
}: RunActivityOfProps) {
  return (
    <RunActivity
      runId={run.id}
      journals={journals}
      work={stopping ? null : workOf(run)}
      station={station}
    />
  );
}
