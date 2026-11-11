import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export interface ThreadedNote {
  readonly runId: RunId | null;
  readonly stationId: StationId;
}

export const inThreadAt = (
  note: ThreadedNote,
  stationId: StationId | null,
  runId: RunId,
): boolean =>
  (note.runId?.equals(runId) ?? false) ||
  (stationId !== null && note.stationId.equals(stationId));
