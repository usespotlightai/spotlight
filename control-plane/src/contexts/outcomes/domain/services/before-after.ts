import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import {
  beganAt,
  type ConfigMarker,
  configMarkersAlong,
} from '@outcomes/domain/services/daily-output';
import { atStation } from '@outcomes/domain/services/team-history';

export interface ChangeSplit {
  readonly marker: ConfigMarker;
  readonly previousFingerprint: string;
  readonly before: readonly RunRecord[];
  readonly after: readonly RunRecord[];
}

interface Place {
  readonly at: number;
  readonly runId: string;
}

const placeOf = (record: RunRecord): Place => ({
  at: beganAt(record)?.getTime() ?? Number.NEGATIVE_INFINITY,
  runId: record.runId.value,
});

const markerPlaceOf = (marker: ConfigMarker): Place => ({
  at: marker.firstRunAt.getTime(),
  runId: marker.runId,
});

const precedes = (one: Place, other: Place): boolean =>
  one.at < other.at || (one.at === other.at && one.runId < other.runId);

const between = (
  records: readonly RunRecord[],
  from: Place | null,
  to: Place | null,
): readonly RunRecord[] =>
  records.filter((each) => {
    const place = placeOf(each);

    return (
      (from === null || !precedes(place, from)) &&
      (to === null || precedes(place, to))
    );
  });

export const changeSplitsOf = (
  records: readonly RunRecord[],
  shown: (marker: ConfigMarker) => boolean,
  before: readonly RunRecord[] = [],
): readonly ChangeSplit[] => {
  const markers = configMarkersAlong(records, before);

  return markers.flatMap((marker) => {
    if (!shown(marker)) {
      return [];
    }

    const here = atStation(records, marker.stationId);
    const sameStation = markers.filter(
      (each) => each.stationId === marker.stationId,
    );
    const order = sameStation.indexOf(marker);
    const previous = sameStation[order - 1];
    const next = sameStation[order + 1];
    const from = previous ? markerPlaceOf(previous) : null;
    const changedAt = markerPlaceOf(marker);
    const to = next ? markerPlaceOf(next) : null;
    const ranWith =
      (fingerprint: string) =>
      (record: RunRecord): boolean =>
        record.end?.fingerprint === fingerprint;

    return [
      {
        marker,
        previousFingerprint: marker.previousFingerprint,
        before: between(here, from, changedAt).filter(
          ranWith(marker.previousFingerprint),
        ),
        after: between(here, from, to).filter(
          (record) =>
            ranWith(marker.fingerprint)(record) &&
            (!record.end?.ranItsConfig ||
              !precedes(placeOf(record), changedAt)),
        ),
      },
    ];
  });
};
