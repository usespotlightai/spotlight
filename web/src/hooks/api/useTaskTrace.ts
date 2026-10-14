import { useQuery } from '@tanstack/react-query';
import { readTaskTrace } from '@/lib/api';

const taskTraceKeys = {
  forTask: (taskId?: string) => ['trace', 'task', taskId ?? null] as const,
};

const POLL_MS = 10_000;

export function useTaskTrace(teamId: string | undefined, taskId?: string) {
  return useQuery({
    queryKey: taskTraceKeys.forTask(taskId),
    enabled: Boolean(teamId && taskId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await readTaskTrace({
        path: { teamId: teamId as string, taskId: taskId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
