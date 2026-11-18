import { useQuery } from '@tanstack/react-query';

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

export function useTaskNotes({ teamId, taskId, from, to }: TaskNotesRange) {
  return useQuery({
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
}
