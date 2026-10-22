import {
  narrowsEndedOnly,
  type RunFilter,
} from '@insights/domain/services/run-filter';
import type { RunProgress } from '@insights/domain/value-objects/run-progress';

export interface UnfinishedRun {
  readonly runId: string;
  readonly taskId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly openedBy: string | null;
  readonly harness: string;
  readonly model: string | null;
  readonly progress: RunProgress;
  readonly queuedAt: Date;
  readonly startedAt: Date | null;
}

const matches = (filter: RunFilter, run: UnfinishedRun): boolean =>
  (filter.lineId === null || filter.lineId === run.lineId) &&
  (filter.stationId === null || filter.stationId === run.stationId) &&
  (filter.harness === null || filter.harness === run.harness) &&
  (filter.taskIds === null || filter.taskIds.includes(run.taskId)) &&
  (filter.personId === null || filter.personId === run.openedBy);

export const unfinishedMatching = (
  runs: readonly UnfinishedRun[],
  filter: RunFilter,
): readonly UnfinishedRun[] =>
  narrowsEndedOnly(filter) ? [] : runs.filter((run) => matches(filter, run));
