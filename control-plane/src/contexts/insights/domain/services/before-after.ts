import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { Score } from '@insights/domain/aggregates/score.aggregate';
import {
  type GroupCounts,
  groupCountsOf,
} from '@insights/domain/services/change-verdict';
import type { CarriedConfigs } from '@insights/domain/services/config-intervals';
import {
  beganAt,
  type ConfigMarker,
  configMarkersAlong,
} from '@insights/domain/services/daily-output';
import {
  judgedByRun,
  judgedRunsOf,
  type RubricRates,
  rubricsOf,
} from '@insights/domain/services/judge-rates';
import {
  atStation,
  startedWithin,
  type TeamHistory,
} from '@insights/domain/services/team-history';
import {
  type InsightsPeriod,
  within,
} from '@insights/domain/value-objects/insights-period.vo';

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
  readonly judgedBefore: readonly RubricRates[];
  readonly judgedAfter: readonly RubricRates[];
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
      before: groupCountsOf(split.before, history.taskPullRequests),
      after: groupCountsOf(split.after, history.taskPullRequests),
      judgedBefore: rubricsOf(split.before, judged),
      judgedAfter: rubricsOf(split.after, judged),
    };
  });
