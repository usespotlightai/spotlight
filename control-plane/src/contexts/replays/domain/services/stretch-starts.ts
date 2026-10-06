import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface StretchStart {
  readonly runId: RunId;
  readonly stationId: string;
  readonly fingerprint: StationFingerprint;
  readonly changedAt: Date;
}

export const inStretchOrder = (
  one: StretchStart,
  other: StretchStart,
): number =>
  one.changedAt.getTime() - other.changedAt.getTime() ||
  (one.runId.value === other.runId.value
    ? 0
    : one.runId.value < other.runId.value
      ? -1
      : 1);

export interface StretchBound {
  readonly stationId: string;
  readonly from: Date;
}

export const latestStartsAt = (
  starts: readonly StretchStart[],
): ReadonlyMap<string, StretchStart> => {
  const latest = new Map<string, StretchStart>();

  for (const start of starts) {
    const known = latest.get(start.stationId);

    if (!known || inStretchOrder(known, start) < 0) {
      latest.set(start.stationId, start);
    }
  }

  return latest;
};
