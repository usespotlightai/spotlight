import { QueryClientContext } from '@tanstack/react-query';
import { useCallback, useContext } from 'react';

import {
  type JournalSource,
  journalKeys,
  prefetchJournals,
  useRunJournals,
} from '@/hooks/api/useRunJournals';
import { listTaskJournalRuns, readTaskJournal } from '@/lib/api';

const taskJournalSource = (
  slug: string | undefined,
  taskId: string | undefined,
): JournalSource => ({
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
});

export function useTaskJournal(
  slug: string | undefined,
  taskId: string | undefined,
  eager: readonly (string | null | undefined)[] = [],
) {
  return useRunJournals(taskJournalSource(slug, taskId), eager);
}

export function usePrefetchTaskJournal(slug: string | undefined) {
  const client = useContext(QueryClientContext);

  return useCallback(
    (taskId: string, eager: readonly (string | null | undefined)[]) =>
      client &&
      void prefetchJournals(client, taskJournalSource(slug, taskId), eager),
    [client, slug],
  );
}
