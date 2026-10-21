import type { TaskRunResponseDto } from '@/lib/api';

export const activityOfState = (
  state: TaskRunResponseDto['state'],
): TaskRunResponseDto['activity'] =>
  state === 'queued' ? 'queued' : state === 'claimed' ? 'working' : null;
