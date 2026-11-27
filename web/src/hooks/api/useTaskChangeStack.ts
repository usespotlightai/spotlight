import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  readTaskChangeStack,
  type NewestChangeStackResponseDto,
} from '@/lib/api';
import { required } from '@/lib/required';

const taskChangeStackKeys = {
  forTask: (taskId?: string) =>
    ['change-stacks', 'task', taskId ?? null] as const,
};

const POLL_MS = 15_000;

export function useTaskChangeStack(
  teamId?: string,
  taskId?: string,
): UseQueryResult<NewestChangeStackResponseDto> {
  return useQuery({
    queryKey: taskChangeStackKeys.forTask(taskId),
    enabled: Boolean(teamId) && Boolean(taskId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await readTaskChangeStack({
        path: { teamId: required(teamId), taskId: required(taskId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
