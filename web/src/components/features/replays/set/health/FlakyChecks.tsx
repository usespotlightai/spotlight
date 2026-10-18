import { HealthTasks } from '@/components/features/replays/set/health/HealthTasks';
import { type ReplaySet, taskTitleIn } from '@/lib/replay';
import {
  FLAKY_TASKS_LABEL,
  formatFlakyCheck,
  type SetHealth,
} from '@/lib/replay-words';
import { runPath } from '@/lib/run';

type FlakyChecksProps = {
  slug: string;
  teamId: string;
  set: ReplaySet;
  checks: NonNullable<SetHealth['checks']>;
};

export function FlakyChecks({ slug, teamId, set, checks }: FlakyChecksProps) {
  return (
    <HealthTasks
      label={FLAKY_TASKS_LABEL}
      tasks={checks.flaky.map((flaky) => ({
        key: flaky.runId,
        title: taskTitleIn(set, flaky.taskId),
        to: runPath(slug, teamId, flaky.runId),
        text: formatFlakyCheck(flaky),
      }))}
    />
  );
}
