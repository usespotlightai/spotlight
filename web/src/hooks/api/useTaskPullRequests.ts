import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  listTaskPullRequests,
  type TaskPullRequestResponseDto,
} from '@/lib/api';
import { useLivePoll } from '@/lib/live';
import { required } from '@/lib/required';

const taskPullRequestKeys = {
  forTask: (taskId?: string) =>
    ['pull-requests', 'task', taskId ?? null] as const,
};

const POLL_MS = 30_000;

export function useTaskPullRequests(
  teamId: string | undefined,
  taskId: string | null | undefined,
): UseQueryResult<TaskPullRequestResponseDto[]> {
  const livePollMs = useLivePoll(POLL_MS);

  return useQuery({
    queryKey: taskPullRequestKeys.forTask(taskId ?? undefined),
    enabled: Boolean(teamId) && Boolean(taskId),
    refetchInterval: livePollMs,
    queryFn: async () => {
      const { data } = await listTaskPullRequests({
        path: { teamId: required(teamId), taskId: required(taskId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
