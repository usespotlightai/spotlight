import { queryOptions, useQuery } from '@tanstack/react-query';
import { usePagedList } from '@/hooks/api/usePagedList';
import { listTasks, readTask } from '@/lib/api';
import { useLivePoll } from '@/lib/live';

export const taskKeys = {
  all: ['tasks'] as const,
  forTeam: (teamId?: string) => ['tasks', teamId ?? null] as const,
  completed: (teamId?: string, lineId?: string) =>
    ['tasks', teamId ?? null, 'completed', lineId ?? null] as const,
  one: (teamId?: string, taskId?: string) =>
    ['tasks', teamId ?? null, 'task', taskId ?? null] as const,
};

const POLL_MS = 5_000;

export const tasksQuery = (teamId: string | undefined) =>
  queryOptions({
    queryKey: taskKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await listTasks({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data.items;
    },
  });

export function useTasks(teamId: string | undefined) {
  const livePollMs = useLivePoll(POLL_MS);

  return useQuery({ ...tasksQuery(teamId), refetchInterval: livePollMs });
}

export function useCompletedTasks(
  teamId: string | undefined,
  lineId: string | undefined,
  enabled: boolean,
) {
  return usePagedList({
    queryKey: taskKeys.completed(teamId, lineId),
    enabled: enabled && Boolean(teamId && lineId),
    keyOf: (task) => task.id,
    fetchPage: async (before?: string) => {
      const { data } = await listTasks({
        path: { teamId: teamId as string },
        query: { state: 'completed-station', lineId, before },
        throwOnError: true,
      });
      return data;
    },
  });
}

export function useTask(
  teamId: string | undefined,
  taskId: string | undefined,
) {
  const livePollMs = useLivePoll(POLL_MS);

  return useQuery({
    queryKey: taskKeys.one(teamId, taskId),
    enabled: Boolean(teamId && taskId),
    refetchInterval: livePollMs,
    queryFn: async () => {
      const { data } = await readTask({
        path: { teamId: teamId as string, taskId: taskId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
