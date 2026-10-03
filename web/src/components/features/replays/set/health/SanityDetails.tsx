import type { ReactNode } from 'react';
import { GainVerdict } from '@/components/features/replays/GainVerdict';
import { HealthTasks } from '@/components/features/replays/set/health/HealthTasks';
import { type ReplaySet, taskTitleIn } from '@/lib/replay';
import {
  AGAINST_LIVE,
  type SetHealth,
  WORSE_TASKS_LABEL,
  worseTaskShown,
} from '@/lib/replay-words';
import { runPath } from '@/lib/run';

type SanityDetailsProps = {
  slug: string;
  teamId: string;
  set: ReplaySet;
  sanity: NonNullable<SetHealth['sanity']>;
  retry: ReactNode;
};

export function SanityDetails({
  slug,
  teamId,
  set,
  sanity,
  retry,
}: SanityDetailsProps) {
  if (!sanity.gain) {
    return retry ? <div className="flex">{retry}</div> : null;
  }

  return (
    <div className="flex flex-col gap-1">
      <GainVerdict gain={sanity.gain} against={AGAINST_LIVE} />
      <HealthTasks
        label={WORSE_TASKS_LABEL}
        tasks={sanity.worse.map((worse) => ({
          key: worse.originalRunId,
          title: taskTitleIn(set, worse.taskId),
          to: runPath(slug, teamId, worse.originalRunId),
          said: worseTaskShown(worse),
        }))}
      />
    </div>
  );
}
