import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listRunChangeStacks, type ChangeStacksResponseDto } from '@/lib/api';
import { inProgress } from '@/lib/change-stack';
import { notFound } from '@/lib/error';
import { required } from '@/lib/required';

export const changeStackKeys = {
  ofRuns: ['change-stacks', 'run'] as const,
  forRun: (runId?: string) => ['change-stacks', 'run', runId ?? null] as const,
  ofTasks: ['change-stacks', 'task-stacks'] as const,
  forTask: (taskId?: string) =>
    ['change-stacks', 'task-stacks', taskId ?? null] as const,
  publicRun: (runId?: string) =>
    ['change-stacks', 'public-run', runId ?? null] as const,
  publicTask: (taskId?: string) =>
    ['change-stacks', 'public-task', taskId ?? null] as const,
};

const POLL_MS = 5_000;

export function useRunChangeStacks(
  teamId?: string,
  runId?: string,
): UseQueryResult<ChangeStacksResponseDto> {
  return useQuery({
    queryKey: changeStackKeys.forRun(runId),
    enabled: Boolean(teamId) && Boolean(runId),
    retry: (failures, error) => !notFound(error) && failures < 3,
    refetchInterval: (query) =>
      query.state.data && inProgress(query.state.data.stacks) ? POLL_MS : false,
    queryFn: async () => {
      const { data } = await listRunChangeStacks({
        path: { teamId: required(teamId), runId: required(runId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
