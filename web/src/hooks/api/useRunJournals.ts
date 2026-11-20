import {
  type QueryClient,
  type QueryKey,
  type QueryPersister,
  type UseQueryResult,
  useQueries,
  useQuery,
} from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import type { JournalledRun, RunJournal } from '@/lib/inbox';
import type { JournalDemand } from '@/lib/journal-demand';
import { CACHE_MAX_AGE_MS, storedJournals } from '@/lib/query-cache';

export const journalKeys = {
  runsOfTask: (taskId?: string) =>
    ['journal-runs', 'task', taskId ?? null] as const,
  runsOfChat: (chatId?: string) =>
    ['journal-runs', 'chat', chatId ?? null] as const,
  ofRun: (runId?: string | null) => ['journal', runId ?? null] as const,
};

export type JournalSource = {
  readonly runsKey: QueryKey;
  readonly enabled: boolean;
  readonly runs: () => Promise<JournalledRun[]>;
  readonly journal: (runId: string) => Promise<RunJournal[]>;
};

export type RunJournals = {
  readonly data: RunJournal[] | undefined;
  readonly isPending: boolean;
  readonly isFetching: boolean;
  readonly errorUpdateCount: number;
  readonly refetch: () => void;
  readonly demand: JournalDemand;
};

type Shown = { readonly runId: string; readonly eager: boolean };

const shownOf = (
  runs: readonly JournalledRun[],
  eager: ReadonlySet<string>,
  wanted: ReadonlySet<string>,
  newestFirst: number,
): Shown[] => {
  const newest = new Set(runs.slice(-newestFirst).map((run) => run.runId));
  const indexed = runs.flatMap(({ runId }) => {
    const first = newest.has(runId) || eager.has(runId);
    return first || wanted.has(runId) ? [{ runId, eager: first }] : [];
  });
  const unindexed = [...eager]
    .filter((runId) => !runs.some((run) => run.runId === runId))
    .map((runId) => ({ runId, eager: true }));

  return [...indexed, ...unindexed];
};

const NONE: readonly JournalledRun[] = [];

const journalQuery = (
  source: JournalSource,
  runId: string,
  first: boolean,
) => ({
  queryKey: journalKeys.ofRun(runId),
  queryFn: () => source.journal(runId),
  gcTime: CACHE_MAX_AGE_MS,
  meta: { persist: false },
  persister: storedJournals.persister,
  ...(first ? {} : { staleTime: Number.POSITIVE_INFINITY }),
});

export const prefetchJournals = async (
  client: QueryClient,
  source: JournalSource,
  eagerIds: readonly (string | null | undefined)[],
  newestFirst = 1,
): Promise<void> => {
  if (!source.enabled) {
    return;
  }

  const runs =
    client.getQueryData<JournalledRun[]>(source.runsKey) ??
    (await client
      .query({ queryKey: source.runsKey, queryFn: source.runs })
      .catch(() => undefined));
  const eager = new Set(eagerIds.filter((id): id is string => Boolean(id)));

  for (const { runId } of shownOf(
    runs ?? NONE,
    eager,
    new Set(),
    newestFirst,
  )) {
    client
      .query({
        ...journalQuery(source, runId, true),
        // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- tsc needs it: query() takes the general persister shape, useQuery's is narrower
        persister: storedJournals.persister as QueryPersister<
          RunJournal[],
          ReturnType<typeof journalKeys.ofRun>
        >,
        staleTime: Number.POSITIVE_INFINITY,
      })
      .catch(() => undefined);
  }
};

const settled = (query: UseQueryResult): boolean =>
  !query.isPending || query.errorUpdateCount > 0;

export function useRunJournals(
  source: JournalSource,
  eagerIds: readonly (string | null | undefined)[],
  newestFirst = 1,
): RunJournals {
  const runs = useQuery({
    queryKey: source.runsKey,
    enabled: source.enabled,
    queryFn: source.runs,
  });
  const [wanted, setWanted] = useState<ReadonlySet<string>>(() => new Set());
  const eagerKey = eagerIds.filter(Boolean).join(' ');
  const eager = useMemo(
    () => new Set(eagerKey ? eagerKey.split(' ') : []),
    [eagerKey],
  );
  const known = runs.data ?? NONE;
  const shown = source.enabled
    ? shownOf(known, eager, wanted, newestFirst)
    : [];

  const journals = useQueries({
    queries: shown.map(({ runId, eager: first }) =>
      journalQuery(source, runId, first),
    ),
  });

  const want = useCallback((runIds: readonly string[]) => {
    setWanted((was) =>
      runIds.every((runId) => was.has(runId))
        ? was
        : new Set([...was, ...runIds]),
    );
  }, []);

  const demand = useMemo(() => ({ runs: known, want }), [known, want]);
  const firstOnes = journals.filter((_, at) => shown[at]?.eager);
  const lost = firstOnes.some(
    (query) => query.data === undefined && query.errorUpdateCount > 0,
  );

  return {
    data:
      runs.data && !lost
        ? journals.flatMap((query) => query.data ?? [])
        : undefined,
    isPending: runs.isPending || !firstOnes.every(settled),
    isFetching: runs.isFetching || journals.some((query) => query.isFetching),
    errorUpdateCount:
      runs.errorUpdateCount +
      firstOnes.reduce((sum, query) => sum + query.errorUpdateCount, 0),
    refetch: () => {
      void runs.refetch();
      for (const query of journals) {
        if (query.isError) {
          void query.refetch();
        }
      }
    },
    demand,
  };
}
