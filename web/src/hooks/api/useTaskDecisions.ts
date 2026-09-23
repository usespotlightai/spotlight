import { useQuery } from '@tanstack/react-query';
import { readTaskDecisions } from '@/lib/api';

export const taskDecisionKeys = {
  forTask: (taskId?: string) => ['decisions', 'task', taskId ?? null] as const,
};

const POLL_MS = 15_000;

export function useTaskDecisions(teamId?: string, taskId?: string) {
  return useQuery({
    queryKey: taskDecisionKeys.forTask(taskId),
    enabled: Boolean(teamId && taskId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await readTaskDecisions({
        path: { teamId: teamId as string, taskId: taskId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
