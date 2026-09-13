import { useQuery } from '@tanstack/react-query';
import { readTaskJournal } from '@/lib/api';

export const journalKeys = {
  forTask: (taskId?: string) => ['journal', taskId ?? null] as const,
};

export function useTaskJournal(
  slug: string | undefined,
  taskId: string | undefined,
) {
  return useQuery({
    queryKey: journalKeys.forTask(taskId),
    enabled: Boolean(slug && taskId),
    queryFn: async () => {
      const { data } = await readTaskJournal({
        path: { slug: slug as string, taskId: taskId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
