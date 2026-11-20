import { useQuery } from '@tanstack/react-query';

import { listTaskPullRequests } from '@/lib/api';
import { useLivePoll } from '@/lib/live';

const taskPullRequestKeys = {
  forTask: (taskId?: string) =>
    ['pull-requests', 'task', taskId ?? null] as const,
};

const POLL_MS = 30_000;

export function useTaskPullRequests(
  teamId: string | undefined,
  taskId: string | null | undefined,
) {
  const livePollMs = useLivePoll(POLL_MS);

  return useQuery({
    queryKey: taskPullRequestKeys.forTask(taskId ?? undefined),
    enabled: Boolean(teamId && taskId),
    refetchInterval: livePollMs,
    queryFn: async () => {
      const { data } = await listTaskPullRequests({
        path: { teamId: teamId as string, taskId: taskId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
