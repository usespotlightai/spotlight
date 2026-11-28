import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listTaskMoves, type TaskMoveResponseDto } from '@/lib/api';
import { useLivePoll } from '@/lib/live';
import { required } from '@/lib/required';

export const taskMoveKeys = {
  forTask: (taskId?: string) => ['task-moves', taskId ?? null] as const,
};

const POLL_MS = 10_000;

export function useTaskMoves(
  teamId: string | undefined,
  taskId?: string,
): UseQueryResult<TaskMoveResponseDto[]> {
  const livePollMs = useLivePoll(POLL_MS);

  return useQuery({
    queryKey: taskMoveKeys.forTask(taskId),
    enabled: Boolean(teamId) && Boolean(taskId),
    refetchInterval: livePollMs,
    queryFn: async () => {
      const { data } = await listTaskMoves({
        path: { teamId: required(teamId), taskId: required(taskId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
