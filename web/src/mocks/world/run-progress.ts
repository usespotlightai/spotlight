import type { TaskRunResponseDto } from '@/lib/api';
import type { Progress } from '@/lib/run';

export const progressOfState = (
  state: TaskRunResponseDto['state'],
  stopping = false,
): Progress | null => {
  if (stopping) {
    return 'stopping';
  }

  if (state === 'queued') {
    return 'queued';
  }

  return state === 'claimed' ? 'in-progress' : null;
};

type RanOn = NonNullable<TaskRunResponseDto['ranOn']>;

export const OWN_POOL: RanOn = {
  kind: 'pool',
  key: 'ephemeral',
  platform: false,
};

export const PLATFORM_POOL: RanOn = {
  kind: 'pool',
  key: 'spotlight',
  platform: true,
};

// Puts the newest run of the task back on the queue, waiting for the reason given.
export const waitingFor = (
  runs: readonly TaskRunResponseDto[],
  reason: NonNullable<TaskRunResponseDto['waiting']>['reason'],
  since: string,
): TaskRunResponseDto[] => {
  const [newest, ...before] = runs;

  return newest
    ? [
        {
          ...newest,
          state: 'queued',
          progress: 'queued',
          exitCode: null,
          waiting: { reason, since },
        },
        ...before,
      ]
    : [];
};
