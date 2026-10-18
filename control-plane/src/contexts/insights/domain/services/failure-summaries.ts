import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { TaskFailures } from '@insights/domain/aggregates/task-failures.aggregate';
import type { FailureOccurrence } from '@insights/domain/value-objects/failure-occurrence.vo';
import {
  type Window,
  within,
} from '@insights/domain/value-objects/insights-period.vo';

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

export const failuresWithin = (
  failures: readonly TaskFailures[],
  window: Window,
  stationId: string | null = null,
): readonly LocatedFailure[] =>
  failures.flatMap((each) =>
    each.occurrences
      .filter(
        (occurrence) =>
          within(window, occurrence.at) &&
          (stationId === null || occurrence.stationId === stationId),
      )
      .map((occurrence) => ({ taskId: each.taskId.value, occurrence })),
  );

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
  records: readonly RunRecord[],
): readonly RunFailureSummary[] => {
  const grouped = new Map<string | null, string[]>();

  for (const record of records) {
    if (record.ending === 'failed') {
      const failure = record.end?.failure ?? null;
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
