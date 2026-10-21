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
