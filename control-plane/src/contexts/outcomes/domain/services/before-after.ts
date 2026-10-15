import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { Score } from '@outcomes/domain/aggregates/score.aggregate';
import {
  type GroupCounts,
  groupCountsOf,
} from '@outcomes/domain/services/change-verdict';
import type { CarriedConfigs } from '@outcomes/domain/services/config-stretches';
import {
  beganAt,
  type ConfigMarker,
  configMarkersAlong,
} from '@outcomes/domain/services/daily-output';
import {
  judgedByRun,
  judgedRunsOf,
  type RubricShares,
  rubricsOf,
} from '@outcomes/domain/services/judge-shares';
import {
  atStation,
  startedWithin,
  type TeamHistory,
} from '@outcomes/domain/services/team-history';
import {
  type InsightsPeriod,
  within,
} from '@outcomes/domain/value-objects/insights-period.vo';

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

export interface ChangeCounts {
  readonly marker: ConfigMarker;
  readonly before: GroupCounts;
  readonly after: GroupCounts;
  readonly judgedBefore: readonly RubricShares[];
  readonly judgedAfter: readonly RubricShares[];
}

export const changeCountsOf = (
  history: TeamHistory,
  period: InsightsPeriod,
  carried: CarriedConfigs,
  scores: readonly Score[],
): readonly ChangeCounts[] =>
  changeSplitsOf(
    startedWithin(history.records, {
      from: carried.from,
      to: period.lookback.to,
    }),
    (marker) => within(period.current, marker.firstRunAt),
    carried.lastRuns,
  ).map((split) => {
    const judged = judgedByRun(judgedRunsOf(scores, split.marker.stationId));

    return {
      marker: split.marker,
      before: groupCountsOf(split.before, history.deliveries),
      after: groupCountsOf(split.after, history.deliveries),
      judgedBefore: rubricsOf(split.before, judged),
      judgedAfter: rubricsOf(split.after, judged),
    };
  });
