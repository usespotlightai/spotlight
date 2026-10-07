import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
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

const EPOCH = new Date(0);

export const startOf = (record: RunRecord): StartedRun => ({
  runId: record.runId,
  beganAt: record.end?.beganAt ?? EPOCH,
});

export const inEndOrder = (one: RunRecord, other: RunRecord): number =>
  (one.end?.endedAt.getTime() ?? 0) - (other.end?.endedAt.getTime() ?? 0) ||
  byRunId(one.runId, other.runId);
