import { useQuery } from '@tanstack/react-query';
import { readTaskChangeStack } from '@/lib/api';

export const taskChangeStackKeys = {
  forTask: (taskId?: string) =>
    ['change-stacks', 'task', taskId ?? null] as const,
};

const POLL_MS = 15_000;

export function useTaskChangeStack(teamId?: string, taskId?: string) {
  return useQuery({
    queryKey: taskChangeStackKeys.forTask(taskId),
    enabled: Boolean(teamId && taskId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await readTaskChangeStack({
        path: { teamId: teamId as string, taskId: taskId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
