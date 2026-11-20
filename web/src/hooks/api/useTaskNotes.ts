import {
  QueryClientContext,
  queryOptions,
  useQuery,
} from '@tanstack/react-query';
import { useCallback, useContext } from 'react';

import { listTaskNotes } from '@/lib/api';

const taskNoteKeys = {
  between: (taskId: string, from: number, to: number) =>
    ['task-notes', taskId, from, to] as const,
};

type TaskNotesRange = {
  readonly teamId: string | undefined;
  readonly taskId: string;
  readonly from: number;
  readonly to: number;
};

const taskNotesQuery = ({ teamId, taskId, from, to }: TaskNotesRange) =>
  queryOptions({
    queryKey: taskNoteKeys.between(taskId, from, to),
    enabled: Boolean(teamId),
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const { data } = await listTaskNotes({
        path: { teamId: teamId as string, taskId },
        query: { from, to },
        throwOnError: true,
      });
      return data;
    },
  });

export function useTaskNotes(range: TaskNotesRange) {
  return useQuery(taskNotesQuery(range));
}

export function usePrefetchTaskNotes() {
  const client = useContext(QueryClientContext);

  return useCallback(
    (range: TaskNotesRange) => {
      if (client && range.teamId) {
        client.query(taskNotesQuery(range)).catch(() => undefined);
      }
    },
    [client],
  );
}
