import type { TaskRunResponseDto } from '@/lib/api';
import type { Work } from '@/lib/run';

export const workOfState = (
  state: TaskRunResponseDto['state'],
): Work | null => {
  if (state === 'queued') {
    return 'queued';
  }

  return state === 'claimed' ? 'in-progress' : null;
};
