import { journalKeys, useRunJournals } from '@/hooks/api/useRunJournals';
import { listTaskJournalRuns, readTaskJournal } from '@/lib/api';

export function useTaskJournal(
  slug: string | undefined,
  taskId: string | undefined,
  eager: readonly (string | null | undefined)[] = [],
) {
  return useRunJournals(
    {
      runsKey: journalKeys.runsOfTask(taskId),
      enabled: Boolean(slug && taskId),
      runs: async () => {
        const { data } = await listTaskJournalRuns({
          path: { slug: slug as string, taskId: taskId as string },
          throwOnError: true,
        });
        return data;
      },
      journal: async (runId) => {
        const { data } = await readTaskJournal({
          path: { slug: slug as string, taskId: taskId as string, runId },
          throwOnError: true,
        });
        return data;
      },
    },
    eager,
  );
}
