import type { TaskRunResponseDto } from '@/lib/api';
import type { Work } from '@/lib/run';

export const workOfState = (
  state: TaskRunResponseDto['state'],
  stopping = false,
): Work | null => {
  if (stopping) {
    return null;
  }

  if (state === 'queued') {
    return 'queued';
  }

  return state === 'claimed' ? 'in-progress' : null;
};
