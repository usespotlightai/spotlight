import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { inStartOrder } from '@insights/domain/services/run-order';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ConfigRun {
  readonly runId: RunId;
  readonly lineId: string;
  readonly stationId: string;
  readonly fingerprint: string;
  readonly beganAt: Date;
}

const configRunOf = (record: RunRecord): ConfigRun | null => {
  const end = record.end;

  return end?.ranItsConfig && end.fingerprint !== null
    ? {
        runId: record.runId,
        lineId: end.location.lineId,
        stationId: end.location.stationId,
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

const configRunsAlong = (records: readonly RunRecord[]): readonly ConfigRun[] =>
  records
    .flatMap((record) => {
      const run = configRunOf(record);
      return run ? [run] : [];
    })
    .sort(inStartOrder);

export interface ConfigChange {
  readonly run: ConfigRun;
  readonly previous: string | null;
}

export interface CarriedConfigs {
  readonly from: Date;
  readonly lastRuns: readonly RunRecord[];
}

export const lastConfigsOf = (
  records: readonly RunRecord[],
): Map<string, string> =>
  new Map(
    configRunsAlong(records).map((run) => [run.stationId, run.fingerprint]),
  );

export const configChangesAlong = (
  records: readonly RunRecord[],
  before: readonly RunRecord[] = [],
): readonly ConfigChange[] => {
  const last = lastConfigsOf(before);

  return configRunsAlong(records).flatMap((run) => {
    const previous = last.get(run.stationId) ?? null;
    last.set(run.stationId, run.fingerprint);

    return previous === run.fingerprint ? [] : [{ run, previous }];
  });
};
