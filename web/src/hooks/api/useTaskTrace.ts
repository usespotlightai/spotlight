import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { readTaskTrace, type TaskTraceResponseDto } from '@/lib/api';
import { required } from '@/lib/required';

export const taskTraceKeys = {
  forTask: (taskId?: string) => ['trace', 'task', taskId ?? null] as const,
};

const POLL_MS = 10_000;

export function useTaskTrace(
  teamId: string | undefined,
  taskId?: string,
): UseQueryResult<TaskTraceResponseDto> {
  return useQuery({
    queryKey: taskTraceKeys.forTask(taskId),
    enabled: Boolean(teamId) && Boolean(taskId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await readTaskTrace({
        path: { teamId: required(teamId), taskId: required(taskId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
