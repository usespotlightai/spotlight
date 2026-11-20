import { useQuery } from '@tanstack/react-query';

import { changeStackKeys } from '@/hooks/api/useRunChangeStacks';
import { listTaskChangeStacks } from '@/lib/api';
import { inProgress } from '@/lib/change-stack';
import { notFound } from '@/lib/error';

const POLL_MS = 5_000;

const PUSH_POLL_MS = 30_000;

export function useTaskChangeStacks(teamId?: string, taskId?: string) {
  return useQuery({
    queryKey: changeStackKeys.forTask(taskId),
    enabled: Boolean(teamId && taskId),
    retry: (failures, error) => !notFound(error) && failures < 3,
    refetchInterval: (query) =>
      query.state.data && inProgress(query.state.data.stacks)
        ? POLL_MS
        : PUSH_POLL_MS,
    queryFn: async () => {
      const { data } = await listTaskChangeStacks({
        path: { teamId: teamId as string, taskId: taskId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
