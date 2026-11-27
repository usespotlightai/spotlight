import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listTaskRuns, type TaskRunResponseDto } from '@/lib/api';
import { useLivePoll } from '@/lib/live';
import { required } from '@/lib/required';

export const taskRunKeys = {
  forTask: (taskId?: string) => ['runs', 'task', taskId ?? null] as const,
};

const POLL_MS = 10_000;

export function useTaskRuns(
  teamId: string | undefined,
  taskId?: string,
): UseQueryResult<TaskRunResponseDto[]> {
  const livePollMs = useLivePoll(POLL_MS);

  return useQuery({
    queryKey: taskRunKeys.forTask(taskId),
    enabled: Boolean(teamId) && Boolean(taskId),
    refetchInterval: livePollMs,
    queryFn: async () => {
      const { data } = await listTaskRuns({
        path: { teamId: required(teamId), taskId: required(taskId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
