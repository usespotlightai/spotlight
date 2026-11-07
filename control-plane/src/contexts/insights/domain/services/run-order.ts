import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface StartedRun {
  readonly runId: RunId;
  readonly beganAt: Date;
}

const byRunId = (one: RunId, other: RunId): number =>
  one.value === other.value ? 0 : one.value < other.value ? -1 : 1;

export const inStartOrder = (one: StartedRun, other: StartedRun): number =>
  one.beganAt.getTime() - other.beganAt.getTime() ||
  byRunId(one.runId, other.runId);

export const startOf = (fact: RunFact): StartedRun => ({
  runId: fact.runId,
  beganAt: fact.end.beganAt,
});
