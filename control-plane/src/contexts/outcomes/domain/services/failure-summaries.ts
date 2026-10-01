import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskFailures } from '@outcomes/domain/aggregates/task-failures.aggregate';
import type { FailureOccurrence } from '@outcomes/domain/value-objects/failure-occurrence.vo';
import {
  type Window,
  within,
} from '@outcomes/domain/value-objects/insights-period.vo';

export interface TaskFailureSummary {
  readonly source: string;
  readonly code: string;
  readonly occurrences: number;
  readonly mostInARow: number;
  readonly taskIds: readonly string[];
}

export interface RunFailureSummary {
  readonly failure: string | null;
  readonly runs: number;
  readonly runIds: readonly string[];
}

interface Located {
  readonly taskId: string;
  readonly occurrence: FailureOccurrence;
}

export const failuresWithin = (
  failures: readonly TaskFailures[],
  window: Window,
  stationId: string | null = null,
): readonly Located[] =>
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
  located: readonly Located[],
): readonly TaskFailureSummary[] => {
  const grouped = new Map<string, Located[]>();

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
        mostInARow: Math.max(
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

  return [...grouped.entries()]
    .map(([failure, runIds]) => ({ failure, runs: runIds.length, runIds }))
    .sort((a, b) => b.runs - a.runs);
};
