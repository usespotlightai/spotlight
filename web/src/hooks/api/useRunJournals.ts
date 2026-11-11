import {
  type QueryKey,
  type UseQueryResult,
  useQueries,
  useQuery,
} from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import type { JournalledRun, RunJournal } from '@/lib/inbox';
import type { JournalDemand } from '@/lib/journal-demand';

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
): Shown[] => {
  const newest = runs.at(-1)?.runId;
  const indexed = runs.flatMap(({ runId }) => {
    const first = runId === newest || eager.has(runId);
    return first || wanted.has(runId) ? [{ runId, eager: first }] : [];
  });
  const unindexed = [...eager]
    .filter((runId) => !runs.some((run) => run.runId === runId))
    .map((runId) => ({ runId, eager: true }));

  return [...indexed, ...unindexed];
};

const NONE: readonly JournalledRun[] = [];

const settled = (query: UseQueryResult): boolean =>
  !query.isPending || query.errorUpdateCount > 0;

export function useRunJournals(
  source: JournalSource,
  eagerIds: readonly (string | null | undefined)[],
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
  const shown = source.enabled ? shownOf(known, eager, wanted) : [];

  const journals = useQueries({
    queries: shown.map(({ runId, eager: first }) => ({
      queryKey: journalKeys.ofRun(runId),
      queryFn: () => source.journal(runId),
      ...(first ? {} : { staleTime: Number.POSITIVE_INFINITY }),
    })),
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
