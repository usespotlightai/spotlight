import { type Spending, spendingOf } from '@insights/domain/services/measures';
import type { UnfinishedRun } from '@insights/domain/services/unfinished-runs';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import type { Money } from '@insights/domain/value-objects/run-usage.vo';

export const MAX_TRACED_RUNS = 5_000;

export interface EndedTraceRun {
  readonly runId: string;
  readonly taskId: string;
  readonly stationId: string;
  readonly openedBy: string | null;
  readonly harness: string;
  readonly model: string | null;
  readonly queuedAt: Date | null;
  readonly startedAt: Date | null;
  readonly endedAt: Date;
  readonly ms: number | null;
  readonly cost: Money | null;
  readonly errors: number | null;
  readonly ending: RunEnding;
  readonly failure: string | null;
}

export type TraceRun =
  | ({ readonly kind: 'ended' } & EndedTraceRun)
  | ({ readonly kind: 'unfinished' } & UnfinishedRun);

export interface Trace {
  readonly taskId: string;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly ms: number | null;
  readonly latestAt: Date;
  readonly runs: readonly TraceRun[];
  readonly total: number;
  readonly errors: number;
  readonly spending: Spending;
}

const startOf = (run: TraceRun): Date =>
  run.kind === 'ended'
    ? (run.queuedAt ?? run.startedAt ?? run.endedAt)
    : run.queuedAt;

const latestOf = (run: TraceRun): Date =>
  run.kind === 'ended' ? run.endedAt : (run.startedAt ?? run.queuedAt);

const byId = (one: string, other: string): number =>
  one < other ? -1 : one > other ? 1 : 0;

const newestFirst = (one: TraceRun, other: TraceRun): number =>
  other.kind === one.kind
    ? latestOf(other).getTime() - latestOf(one).getTime() ||
      byId(other.runId, one.runId)
    : one.kind === 'unfinished'
      ? -1
      : 1;

const traceOf = (
  taskId: string,
  runs: readonly TraceRun[],
  total: number,
): Trace => {
  const ordered = [...runs].sort(newestFirst);
  const ended = ordered.flatMap((each) =>
    each.kind === 'ended' ? [each] : [],
  );
  const startedAt = new Date(
    Math.min(...ordered.map((each) => startOf(each).getTime())),
  );
  const endedAt =
    ended.length === ordered.length
      ? new Date(Math.max(...ended.map((each) => each.endedAt.getTime())))
      : null;

  return {
    taskId,
    startedAt,
    endedAt,
    ms: endedAt && endedAt.getTime() - startedAt.getTime(),
    latestAt: new Date(
      Math.max(...ordered.map((each) => latestOf(each).getTime())),
    ),
    runs: ordered,
    total: Math.max(total, ordered.length),
    errors: ended.reduce((sum, each) => sum + (each.errors ?? 0), 0),
    spending: spendingOf(ended.map((each) => each.cost)),
  };
};

export const tracesOf = (
  ended: readonly EndedTraceRun[],
  unfinished: readonly UnfinishedRun[],
  totals: ReadonlyMap<string, number> | null,
): readonly Trace[] => {
  const endedIds = new Set(ended.map((each) => each.runId));
  const byTask = new Map<string, TraceRun[]>();

  for (const run of [
    ...unfinished
      .filter((each) => !endedIds.has(each.runId))
      .map((each) => ({ kind: 'unfinished' as const, ...each })),
    ...ended.map((each) => ({ kind: 'ended' as const, ...each })),
  ]) {
    const listed = byTask.get(run.taskId);

    if (listed) {
      listed.push(run);
    } else {
      byTask.set(run.taskId, [run]);
    }
  }

  return [...byTask]
    .map(([taskId, runs]) =>
      traceOf(taskId, runs, totals?.get(taskId) ?? runs.length),
    )
    .sort(
      (one, other) =>
        Number(other.endedAt === null) - Number(one.endedAt === null) ||
        other.latestAt.getTime() - one.latestAt.getTime() ||
        byId(one.taskId, other.taskId),
    );
};

export const runsPerTask = (
  runs: readonly { readonly taskId: string }[],
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();

  for (const run of runs) {
    counts.set(run.taskId, (counts.get(run.taskId) ?? 0) + 1);
  }

  return counts;
};
