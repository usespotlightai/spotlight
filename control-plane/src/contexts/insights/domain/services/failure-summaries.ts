import type { FailureOccurrence } from '@insights/domain/value-objects/failure-occurrence.vo';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';

export interface TaskFailureSummary {
  readonly source: string;
  readonly code: string;
  readonly occurrences: number;
  readonly maxInARow: number;
  readonly taskIds: readonly string[];
}

export interface RunFailureSummary {
  readonly failure: string | null;
  readonly runs: number;
  readonly runIds: readonly string[];
}

export interface LocatedFailure {
  readonly taskId: string;
  readonly occurrence: FailureOccurrence;
}

export const taskFailureSummaries = (
  located: readonly LocatedFailure[],
): readonly TaskFailureSummary[] => {
  const grouped = new Map<string, LocatedFailure[]>();

  for (const each of located) {
    const key = `${each.occurrence.source}\u0000${each.occurrence.code}`;
    grouped.set(key, [...(grouped.get(key) ?? []), each]);
  }

  return [...grouped.values()]
    .map((group) => {
      const [first] = group;

      return {
        source: first?.occurrence.source ?? '',
        code: first?.occurrence.code ?? '',
        occurrences: group.length,
        maxInARow: Math.max(
          ...group.map((each) => each.occurrence.occurrences),
        ),
        taskIds: [...new Set(group.map((each) => each.taskId))],
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences);
};

export const runFailureSummaries = (
  facts: readonly RunFact[],
): readonly RunFailureSummary[] => {
  const grouped = new Map<string | null, string[]>();

  for (const record of facts) {
    if (record.ending === 'failed') {
      const failure = record.end.failure;
      grouped.set(failure, [
        ...(grouped.get(failure) ?? []),
        record.runId.value,
      ]);
    }
  }

  return mostRunsFirst(
    [...grouped.entries()].map(([failure, runIds]) => ({
      failure,
      runs: runIds.length,
      runIds,
    })),
  );
};

export const mostRunsFirst = (
  summaries: readonly RunFailureSummary[],
): readonly RunFailureSummary[] =>
  [...summaries].sort((a, b) => b.runs - a.runs);
