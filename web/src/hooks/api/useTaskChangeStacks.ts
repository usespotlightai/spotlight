import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { changeStackKeys } from '@/hooks/api/useRunChangeStacks';
import { listTaskChangeStacks, type ChangeStacksResponseDto } from '@/lib/api';
import { inProgress } from '@/lib/change-stack';
import { notFound } from '@/lib/error';
import { required } from '@/lib/required';

const POLL_MS = 5_000;

const PUSH_POLL_MS = 30_000;

export function useTaskChangeStacks(
  teamId?: string,
  taskId?: string,
): UseQueryResult<ChangeStacksResponseDto> {
  return useQuery({
    queryKey: changeStackKeys.forTask(taskId),
    enabled: Boolean(teamId) && Boolean(taskId),
    retry: (failures, error) => !notFound(error) && failures < 3,
    refetchInterval: (query) =>
      query.state.data && inProgress(query.state.data.stacks)
        ? POLL_MS
        : PUSH_POLL_MS,
    queryFn: async () => {
      const { data } = await listTaskChangeStacks({
        path: { teamId: required(teamId), taskId: required(taskId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
