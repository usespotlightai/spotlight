import { inStartOrder } from '@insights/domain/services/run-order';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ConfigRun {
  readonly runId: RunId;
  readonly lineId: string;
  readonly stationId: string;
  readonly fingerprint: string;
  readonly beganAt: Date;
}

const configRunOf = (record: RunFact): ConfigRun | null => {
  const end = record.end;

  return end.ranAConfig && end.fingerprint !== null
    ? {
        runId: record.runId,
        lineId: end.location.lineId.value,
        stationId: end.location.stationId.value,
        fingerprint: end.fingerprint,
        beganAt: end.beganAt,
      }
    : null;
};

export interface ConfigIntervalBound {
  readonly stationId: string;
  readonly from: Date;
  readonly fromRun?: RunId;
}

const earlier = (
  one: ConfigIntervalBound,
  other: ConfigIntervalBound,
): boolean =>
  one.from.getTime() < other.from.getTime() ||
  (one.from.getTime() === other.from.getTime() &&
    (one.fromRun === undefined ||
      (other.fromRun !== undefined &&
        one.fromRun.value < other.fromRun.value)));

export const earliestBounds = (
  bounds: readonly ConfigIntervalBound[],
): ReadonlyMap<string, ConfigIntervalBound> => {
  const earliest = new Map<string, ConfigIntervalBound>();

  for (const bound of bounds) {
    const known = earliest.get(bound.stationId);

    if (!known || earlier(bound, known)) {
      earliest.set(bound.stationId, bound);
    }
  }

  return earliest;
};

const configRunsAlong = (records: readonly RunFact[]): readonly ConfigRun[] =>
  records
    .flatMap((record) => {
      const run = configRunOf(record);
      return run ? [run] : [];
    })
    .sort(inStartOrder);

export const lastConfigsOf = (
  records: readonly RunFact[],
): Map<string, string> =>
  new Map(
    configRunsAlong(records).map((run) => [run.stationId, run.fingerprint]),
  );
