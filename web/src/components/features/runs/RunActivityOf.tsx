import { RunActivity } from '@/components/features/runs/RunActivity';
import type { RunJournal } from '@/lib/inbox';
import { queued, type Run, running } from '@/lib/run';

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
      running={running(run) && !stopping}
      queued={queued(run) && !stopping}
      station={station}
    />
  );
}
