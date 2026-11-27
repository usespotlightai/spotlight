import {
  type QueryKeyWithDataTag,
  type UnusedSkipTokenOptions,
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import { type PagedList, usePagedList } from '@/hooks/api/usePagedList';
import { listTasks, readTask, type TaskResponseDto } from '@/lib/api';
import { liveStaleTime, useLivePoll } from '@/lib/live';
import { required } from '@/lib/required';

export const taskKeys = {
  all: ['tasks'] as const,
  forTeam: (teamId?: string) => ['tasks', teamId ?? null] as const,
  completed: (teamId?: string, lineId?: string) =>
    ['tasks', teamId ?? null, 'completed', lineId ?? null] as const,
  searchedCompleted: (teamId: string, search: string) =>
    ['tasks', teamId, 'completed', 'search', search] as const,
  one: (teamId?: string, taskId?: string) =>
    ['tasks', teamId ?? null, 'task', taskId ?? null] as const,
};

const POLL_MS = 5_000;

type TasksKey = ReturnType<typeof taskKeys.forTeam>;

type TasksQuery = UnusedSkipTokenOptions<
  TaskResponseDto[],
  Error,
  TaskResponseDto[],
  TasksKey
> &
  QueryKeyWithDataTag<TasksKey, TaskResponseDto[]>;

export const tasksQuery = (teamId: string | undefined): TasksQuery =>
  queryOptions({
    queryKey: taskKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await listTasks({
        path: { teamId: required(teamId) },
        throwOnError: true,
      });
      return data.items;
    },
  });

const SEARCHED_AT_MOST = 10;

type SearchedTasksKey = ReturnType<typeof taskKeys.searchedCompleted>;

type SearchedTasksQuery = UnusedSkipTokenOptions<
  TaskResponseDto[],
  Error,
  TaskResponseDto[],
  SearchedTasksKey
> &
  QueryKeyWithDataTag<SearchedTasksKey, TaskResponseDto[]>;

export const searchedCompletedTasksQuery = (
  teamId: string,
  search: string,
): SearchedTasksQuery =>
  queryOptions({
    queryKey: taskKeys.searchedCompleted(teamId, search),
    queryFn: async () => {
      const { data } = await listTasks({
        path: { teamId },
        query: { state: 'completed-station', search, limit: SEARCHED_AT_MOST },
        throwOnError: true,
      });
      return data.items;
    },
  });

export function useTasks(
  teamId: string | undefined,
): UseQueryResult<TaskResponseDto[]> {
  const livePollMs = useLivePoll(POLL_MS);

  return useQuery({
    ...tasksQuery(teamId),
    refetchInterval: livePollMs,
    staleTime: liveStaleTime,
  });
}

export function useCompletedTasks(
  teamId: string | undefined,
  lineId: string | undefined,
  enabled: boolean,
): PagedList<TaskResponseDto> {
  return usePagedList({
    queryKey: taskKeys.completed(teamId, lineId),
    enabled: enabled && Boolean(teamId) && Boolean(lineId),
    keyOf: (task) => task.id,
    fetchPage: async (before?: string) => {
      const { data } = await listTasks({
        path: { teamId: required(teamId) },
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
): UseQueryResult<TaskResponseDto> {
  const livePollMs = useLivePoll(POLL_MS);

  return useQuery({
    queryKey: taskKeys.one(teamId, taskId),
    enabled: Boolean(teamId) && Boolean(taskId),
    refetchInterval: livePollMs,
    staleTime: liveStaleTime,
    queryFn: async () => {
      const { data } = await readTask({
        path: { teamId: required(teamId), taskId: required(taskId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
