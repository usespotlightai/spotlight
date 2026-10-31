import { useQuery } from '@tanstack/react-query';
import { listTasks } from '@/lib/api';

export const taskKeys = {
  forTeam: (teamId?: string) => ['tasks', teamId ?? null] as const,
};

const POLL_MS = 5_000;

export function useTasks(teamId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await listTasks({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
