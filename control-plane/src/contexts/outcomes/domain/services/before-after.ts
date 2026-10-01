import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import {
  type ConfigMarker,
  configMarkersAlong,
  firstRanAt,
} from '@outcomes/domain/services/daily-output';
import { atStation } from '@outcomes/domain/services/team-history';

export interface ChangeSplit {
  readonly marker: ConfigMarker;
  readonly previousFingerprint: string | null;
  readonly before: readonly RunRecord[];
  readonly after: readonly RunRecord[];
}

const startOf = (record: RunRecord): number =>
  firstRanAt(record)?.getTime() ?? 0;

const between = (
  records: readonly RunRecord[],
  from: number,
  to: number,
): readonly RunRecord[] =>
  records.filter((each) => startOf(each) >= from && startOf(each) < to);

export const changeSplitsOf = (
  records: readonly RunRecord[],
  shown: (marker: ConfigMarker) => boolean,
): readonly ChangeSplit[] => {
  const ended = records.filter((each) => each.hasEnded);
  const markers = configMarkersAlong(ended);

  return markers.flatMap((marker) => {
    if (!shown(marker)) {
      return [];
    }

    const here = [...atStation(ended, marker.stationId)].sort(
      (a, b) => startOf(a) - startOf(b),
    );
    const sameStation = markers.filter(
      (each) => each.stationId === marker.stationId,
    );
    const order = sameStation.indexOf(marker);
    const previous = sameStation[order - 1];
    const next = sameStation[order + 1];
    const from = previous?.firstRunAt.getTime() ?? Number.NEGATIVE_INFINITY;
    const changedAt = marker.firstRunAt.getTime();
    const to = next?.firstRunAt.getTime() ?? Number.POSITIVE_INFINITY;
    const leading = between(here, from, changedAt);
    const previousFingerprint =
      [...leading].reverse().find((each) => each.end?.fingerprint)?.end
        ?.fingerprint ?? null;
    const ranWith =
      (fingerprint: string | null) =>
      (record: RunRecord): boolean =>
        fingerprint !== null && record.end?.fingerprint === fingerprint;

    return [
      {
        marker,
        previousFingerprint,
        before: leading.filter(ranWith(previousFingerprint)),
        after: between(here, changedAt, to).filter(ranWith(marker.fingerprint)),
      },
    ];
  });
};
