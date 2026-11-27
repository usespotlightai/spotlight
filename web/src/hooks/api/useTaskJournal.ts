import { QueryClientContext } from '@tanstack/react-query';
import { useCallback, useContext } from 'react';

import {
  type JournalSource,
  type RunJournals,
  journalKeys,
  prefetchJournals,
  useRunJournals,
} from '@/hooks/api/useRunJournals';
import { listTaskJournalRuns, readTaskJournal } from '@/lib/api';
import { required } from '@/lib/required';

type PrefetchTaskJournal = (
  taskId: string,
  eager: readonly (string | null | undefined)[],
) => void;

const taskJournalSource = (
  slug: string | undefined,
  taskId: string | undefined,
): JournalSource => ({
  runsKey: journalKeys.runsOfTask(taskId),
  enabled: Boolean(slug) && Boolean(taskId),
  runs: async () => {
    const { data } = await listTaskJournalRuns({
      path: { slug: required(slug), taskId: required(taskId) },
      throwOnError: true,
    });
    return data;
  },
  journal: async (runId) => {
    const { data } = await readTaskJournal({
      path: { slug: required(slug), taskId: required(taskId), runId },
      throwOnError: true,
    });
    return data;
  },
});

export function useTaskJournal(
  slug: string | undefined,
  taskId: string | undefined,
  eager: readonly (string | null | undefined)[] = [],
): RunJournals {
  return useRunJournals(taskJournalSource(slug, taskId), eager);
}

export function usePrefetchTaskJournal(
  slug: string | undefined,
): PrefetchTaskJournal {
  const client = useContext(QueryClientContext);

  return useCallback(
    (taskId: string, eager: readonly (string | null | undefined)[]) =>
      client &&
      void prefetchJournals(client, taskJournalSource(slug, taskId), eager),
    [client, slug],
  );
}
