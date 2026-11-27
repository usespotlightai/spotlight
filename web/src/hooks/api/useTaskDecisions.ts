import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { readTaskDecisions, type TaskDecisionsResponseDto } from '@/lib/api';
import { required } from '@/lib/required';

export const taskDecisionKeys = {
  forTask: (taskId?: string) => ['decisions', 'task', taskId ?? null] as const,
};

const POLL_MS = 15_000;

export function useTaskDecisions(
  teamId?: string,
  taskId?: string,
): UseQueryResult<TaskDecisionsResponseDto> {
  return useQuery({
    queryKey: taskDecisionKeys.forTask(taskId),
    enabled: Boolean(teamId) && Boolean(taskId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await readTaskDecisions({
        path: { teamId: required(teamId), taskId: required(taskId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
