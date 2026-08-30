import { useQuery } from '@tanstack/react-query';
import { listTaskRuns } from '@/lib/api';

export const taskRunKeys = {
  forTask: (taskId?: string) => ['runs', 'task', taskId ?? null] as const,
};

const POLL_MS = 10_000;

export function useTaskRuns(teamId: string | undefined, taskId?: string) {
  return useQuery({
    queryKey: taskRunKeys.forTask(taskId),
    enabled: Boolean(teamId && taskId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await listTaskRuns({
        path: { teamId: teamId as string, taskId: taskId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
