import type { BotActivity } from '@outcomes/domain/aggregates/pull-request-record.aggregate';
import { inboxWaitsWithin } from '@outcomes/domain/services/flow';
import {
  type ByPercentile,
  between,
  byPercentile,
  known,
  type Percentile,
  type Percentiles,
  percentilesOf,
  rateOf,
} from '@outcomes/domain/services/measures';
import {
  comparedRepositoriesOf,
  inRepositories,
  mergedWithin,
  weeksOf,
  weekWindowOf,
} from '@outcomes/domain/services/pull-request-insights';
import {
  openingsOf,
  type StationPlace,
  stationsOf,
  type TeamHistory,
} from '@outcomes/domain/services/team-history';
import {
  ROUND_BUCKETS,
  type RoundBucket,
  roundBucketOf,
  type TeamPullRequest,
  toMergeMs,
} from '@outcomes/domain/services/team-pull-requests';
import {
  type Change,
  changeOf,
} from '@outcomes/domain/value-objects/change.vo';
import {
  type InsightsPeriod,
  type Window,
  within,
} from '@outcomes/domain/value-objects/insights-period.vo';
import {
  PULL_REQUEST_TYPES,
  type PullRequestType,
} from '@outcomes/domain/value-objects/pull-request-type';

const DAY_MS = 24 * 60 * 60 * 1000;

const ROLLING_DAYS = 7;

export interface ByAuthor {
  readonly spotlight: Percentiles;
  readonly people: Percentiles;
}

interface PercentileChanges {
  readonly p50: Change | null;
  readonly p75: Change | null;
  readonly p90: Change | null;
  readonly p95: Change | null;
}

export interface ByAuthorChanges {
  readonly spotlight: PercentileChanges;
  readonly people: PercentileChanges;
}

interface MergeDay {
  readonly day: string;
  readonly daily: ByAuthor;
  readonly rolling: ByAuthor;
}

interface TypeMerge {
  readonly type: PullRequestType;
  readonly merged: number;
  readonly toMerge: ByAuthor;
}

export interface RoundsCount {
  readonly rounds: RoundBucket;
  readonly merged: number;
  readonly share: number | null;
}

interface DepthWeek {
  readonly week: string;
  readonly merged: number;
  readonly rounds: readonly RoundsCount[];
}

interface ReviewDay {
  readonly day: string;
  readonly toFirstReview: {
    readonly daily: Percentiles;
    readonly rolling: Percentiles;
  };
  readonly awaiting: number;
  readonly humanReviews: number;
}

interface ReviewBot {
  readonly login: string;
  readonly comments: number;
  readonly reviews: number;
  readonly resolvedShare: number | null;
}

export const STATION_PARTS = ['queued', 'running', 'inbox'] as const;

export type StationPart = (typeof STATION_PARTS)[number];

type StageParts = Readonly<Record<StationPart, Percentiles>>;

interface Timed {
  readonly total: Percentiles;
  readonly parts: StageParts | null;
}

export interface StageTimes extends Timed {
  readonly jam: ByPercentile<number>;
  readonly worst: ByPercentile<boolean>;
  readonly longestPart: ByPercentile<StationPart | null> | null;
}

interface Typed<T> {
  readonly all: T;
  readonly types: readonly {
    readonly type: PullRequestType;
    readonly times: T;
  }[];
}

export type ByType = Typed<StageTimes>;

export const FLOW_STAGE_KINDS = [
  'coding',
  'station',
  'awaitingReview',
  'inReview',
  'awaitingMerge',
] as const;

export type FlowStageKind = (typeof FLOW_STAGE_KINDS)[number];

interface Stage<T> {
  readonly kind: FlowStageKind;
  readonly place: StationPlace | null;
  readonly times: Typed<T>;
}

export type FlowStage = Stage<StageTimes>;

const FLOW_LAYOUTS = ['stations', 'stages'] as const;

export type FlowLayout = (typeof FLOW_LAYOUTS)[number];

interface PipelineOpening {
  readonly taskId: string;
  readonly openedAt: Date;
}

interface PipelinePassage {
  readonly taskId: string;
  readonly stationId: string;
  readonly queued: number;
  readonly running: number;
  readonly inbox: number;
}

export interface PipelineCounts {
  readonly openings: readonly PipelineOpening[];
  readonly stations: readonly StationPlace[];
  readonly passages: readonly PipelinePassage[];
}

interface PipelineFlow {
  readonly merged: number;
  readonly types: readonly {
    readonly type: PullRequestType;
    readonly merged: number;
  }[];
  readonly layouts: Readonly<Record<FlowLayout, readonly FlowStage[]>>;
}

export interface Shipping {
  readonly toMerge: ByAuthor;
  readonly toMergeChanges: ByAuthorChanges;
  readonly mergeDays: readonly MergeDay[];
  readonly types: readonly TypeMerge[];
  readonly slowestFirst: ByPercentile<readonly PullRequestType[]>;
  readonly depth: readonly DepthWeek[];
  readonly depthTotals: readonly RoundsCount[];
  readonly reviewDays: readonly ReviewDay[];
  readonly bots: readonly ReviewBot[];
  readonly pipeline: PipelineFlow;
  readonly shippedAny: boolean;
}

const dayWindowOf = (day: string): Window => {
  const from = new Date(`${day}T00:00:00.000Z`);

  return { from, to: new Date(from.getTime() + DAY_MS) };
};

const rollingWindowOf = (day: string): Window => {
  const { to } = dayWindowOf(day);

  return { from: new Date(to.getTime() - ROLLING_DAYS * DAY_MS), to };
};

const comparedOf = (
  pullRequests: readonly TeamPullRequest[],
  repositories: readonly string[],
): readonly TeamPullRequest[] => [
  ...pullRequests.filter((each) => each.by === 'spotlight'),
  ...inRepositories(
    pullRequests.filter((each) => each.by === 'people'),
    repositories,
  ),
];

const byAuthorOf = (merged: readonly TeamPullRequest[]): ByAuthor => ({
  spotlight: percentilesOf(
    known(merged.filter((each) => each.by === 'spotlight').map(toMergeMs)),
  ),
  people: percentilesOf(
    known(merged.filter((each) => each.by === 'people').map(toMergeMs)),
  ),
});

const fallingIsBetter = { better: 'down', unit: 'percent' } as const;

const percentileChangesOf = (
  now: Percentiles,
  before: Percentiles,
): PercentileChanges => ({
  p50: changeOf(now.p50, before.p50, fallingIsBetter),
  p75: changeOf(now.p75, before.p75, fallingIsBetter),
  p90: changeOf(now.p90, before.p90, fallingIsBetter),
  p95: changeOf(now.p95, before.p95, fallingIsBetter),
});

const byAuthorChangesOf = (
  now: ByAuthor,
  before: ByAuthor,
): ByAuthorChanges => ({
  spotlight: percentileChangesOf(now.spotlight, before.spotlight),
  people: percentileChangesOf(now.people, before.people),
});

const lasted = (from: Date | null, to: Date | null): number | null =>
  from && to ? Math.max(0, between(from, to)) : null;

const earliest = (one: Date | null, other: Date | null): Date | null =>
  one && other
    ? one.getTime() <= other.getTime()
      ? one
      : other
    : (one ?? other);

const draftedMs = (each: TeamPullRequest, from: Date, to: Date): number =>
  each.seen.draftSpells.reduce(
    (sum, spell) =>
      sum +
      Math.max(
        0,
        Math.min(to.getTime(), spell.to?.getTime() ?? to.getTime()) -
          Math.max(from.getTime(), spell.from.getTime()),
      ),
    0,
  );

const toFirstReviewMs = (each: TeamPullRequest): number | null => {
  const ready = each.seen.readyForReviewAt;
  const reviewed = each.seen.firstUnblockingReviewAt;
  const waited = lasted(ready, reviewed);

  return ready && reviewed && waited !== null
    ? Math.max(0, waited - draftedMs(each, ready, reviewed))
    : null;
};

const draftAt = (each: TeamPullRequest, at: Date): boolean =>
  each.seen.draftSpells.some(
    (spell) =>
      spell.from.getTime() <= at.getTime() &&
      (spell.to === null || spell.to.getTime() > at.getTime()),
  );

const awaitingAt = (each: TeamPullRequest, at: Date): boolean => {
  const ready = each.seen.readyForReviewAt;
  const reviewed = each.seen.firstUnblockingReviewAt;
  const closed = each.seen.closedAt;

  return (
    ready !== null &&
    ready.getTime() <= at.getTime() &&
    !draftAt(each, at) &&
    (!reviewed || reviewed.getTime() > at.getTime()) &&
    (!closed || closed.getTime() > at.getTime())
  );
};

const mergeDaysOf = (
  compared: readonly TeamPullRequest[],
  days: readonly string[],
): readonly MergeDay[] =>
  days.map((day) => ({
    day,
    daily: byAuthorOf(mergedWithin(compared, dayWindowOf(day))),
    rolling: byAuthorOf(mergedWithin(compared, rollingWindowOf(day))),
  }));

const typeMergesOf = (
  merged: readonly TeamPullRequest[],
): readonly TypeMerge[] =>
  PULL_REQUEST_TYPES.flatMap((type) => {
    const typed = merged.filter((each) => each.type === type);

    return typed.length > 0
      ? [{ type, merged: typed.length, toMerge: byAuthorOf(typed) }]
      : [];
  });

const slowerFirst = (one: number | null, other: number | null): number =>
  one === null || other === null
    ? Number(one === null) - Number(other === null)
    : other - one;

const slowestFirstOf = (
  types: readonly TypeMerge[],
): ByPercentile<readonly PullRequestType[]> =>
  byPercentile((percentile) =>
    [...types]
      .sort((one, other) =>
        slowerFirst(
          one.toMerge.spotlight[percentile],
          other.toMerge.spotlight[percentile],
        ),
      )
      .map((each) => each.type),
  );

const roundsCountsOf = (
  counted: (rounds: RoundBucket) => number,
): readonly RoundsCount[] => {
  const merged = ROUND_BUCKETS.map(counted);
  const all = merged.reduce((sum, each) => sum + each, 0);

  return ROUND_BUCKETS.map((rounds, at) => ({
    rounds,
    merged: merged[at] ?? 0,
    share: rateOf(merged[at] ?? 0, all),
  }));
};

const overlapOf = (one: Window, other: Window): Window => ({
  from: new Date(Math.max(one.from.getTime(), other.from.getTime())),
  to: new Date(Math.min(one.to.getTime(), other.to.getTime())),
});

const depthWeeksOf = (
  compared: readonly TeamPullRequest[],
  window: Window,
): readonly DepthWeek[] =>
  weeksOf(window).map((week) => {
    const merged = mergedWithin(
      compared,
      overlapOf(weekWindowOf(week), window),
    );

    return {
      week,
      merged: merged.length,
      rounds: roundsCountsOf(
        (rounds) =>
          merged.filter(
            (each) => roundBucketOf(each.seen.reviewRounds) === rounds,
          ).length,
      ),
    };
  });

const depthTotalsOf = (weeks: readonly DepthWeek[]): readonly RoundsCount[] =>
  roundsCountsOf((rounds) =>
    weeks.reduce(
      (sum, week) =>
        sum + (week.rounds.find((each) => each.rounds === rounds)?.merged ?? 0),
      0,
    ),
  );

const firstReviewedWithin = (
  reviewed: readonly TeamPullRequest[],
  window: Window,
): Percentiles =>
  percentilesOf(
    known(
      reviewed
        .filter((each) => within(window, each.seen.firstUnblockingReviewAt))
        .map(toFirstReviewMs),
    ),
  );

const reviewDaysOf = (
  reviewed: readonly TeamPullRequest[],
  days: readonly string[],
): readonly ReviewDay[] =>
  days.map((day) => {
    const window = dayWindowOf(day);

    return {
      day,
      toFirstReview: {
        daily: firstReviewedWithin(reviewed, window),
        rolling: firstReviewedWithin(reviewed, rollingWindowOf(day)),
      },
      awaiting: reviewed.filter((each) => awaitingAt(each, window.to)).length,
      humanReviews: reviewed.reduce(
        (sum, each) =>
          sum +
          each.seen.humanReviewedAt.filter((at) => within(window, at)).length,
        0,
      ),
    };
  });

const activeWithin = (each: TeamPullRequest, window: Window): boolean =>
  each.seen.openedAt.getTime() < window.to.getTime() &&
  (!each.seen.closedAt ||
    each.seen.closedAt.getTime() >= window.from.getTime());

const botsOf = (
  pullRequests: readonly TeamPullRequest[],
  window: Window,
): readonly ReviewBot[] => {
  const summed = new Map<string, BotActivity>();

  for (const activity of pullRequests
    .filter((each) => activeWithin(each, window))
    .flatMap((each) => each.seen.botActivity)) {
    const was = summed.get(activity.login);
    summed.set(
      activity.login,
      was
        ? {
            login: activity.login,
            reviews: was.reviews + activity.reviews,
            comments: was.comments + activity.comments,
            threads: was.threads + activity.threads,
            resolvedThreads: was.resolvedThreads + activity.resolvedThreads,
          }
        : activity,
    );
  }

  return [...summed.values()]
    .map((each) => ({
      login: each.login,
      comments: each.comments,
      reviews: each.reviews,
      resolvedShare:
        each.threads > 0 ? each.resolvedThreads / each.threads : null,
    }))
    .sort((one, other) => other.comments - one.comments);
};

interface Passage {
  readonly type: PullRequestType;
  readonly total: number | null;
  readonly parts: {
    readonly queued: number;
    readonly running: number;
    readonly inbox: number;
  } | null;
}

const timesOf = (passages: readonly Passage[], parted: boolean): Timed => ({
  total: percentilesOf(known(passages.map((each) => each.total))),
  parts: parted
    ? {
        queued: percentilesOf(passages.map((each) => each.parts?.queued ?? 0)),
        running: percentilesOf(
          passages.map((each) => each.parts?.running ?? 0),
        ),
        inbox: percentilesOf(passages.map((each) => each.parts?.inbox ?? 0)),
      }
    : null,
});

const byTypeOf = (
  passages: readonly Passage[],
  parted = false,
): Typed<Timed> => {
  const timed = passages.filter((each) => each.total !== null);

  return {
    all: timesOf(timed, parted),
    types: PULL_REQUEST_TYPES.flatMap((type) => {
      const typed = timed.filter((each) => each.type === type);

      return typed.length > 0 ? [{ type, times: timesOf(typed, parted) }] : [];
    }),
  };
};

const sumOf = (values: readonly number[]): number =>
  values.reduce((sum, each) => sum + each, 0);

const timedFor = (
  stage: Stage<Timed>,
  type: PullRequestType | null,
): Timed | null =>
  type
    ? (stage.times.types.find((each) => each.type === type)?.times ?? null)
    : stage.times.all;

const worstOf = (lasted: readonly (number | null)[]): number =>
  lasted.reduce<number>(
    (worst, each, at) =>
      each !== null && (lasted[worst] ?? -1) < each ? at : worst,
    -1,
  );

const longestPartOf = (
  parts: StageParts | null,
): ByPercentile<StationPart | null> | null =>
  parts
    ? byPercentile((percentile) =>
        STATION_PARTS.reduce<StationPart | null>(
          (longest, part) =>
            (parts[part][percentile] ?? 0) >
            (longest ? (parts[longest][percentile] ?? 0) : 0)
              ? part
              : longest,
          null,
        ),
      )
    : null;

const jammedOf = (stages: readonly Stage<Timed>[]): readonly FlowStage[] => {
  const judged = (
    times: Timed,
    at: number,
    type: PullRequestType | null,
  ): StageTimes => {
    const lastedAt = (percentile: Percentile): (number | null)[] =>
      stages.map((stage) => timedFor(stage, type)?.total[percentile] ?? null);

    return {
      ...times,
      jam: byPercentile((percentile) => {
        const lasted = lastedAt(percentile);
        const most = Math.max(0, ...lasted.map((each) => each ?? 0));

        return most === 0 ? 0 : (lasted[at] ?? 0) / most;
      }),
      worst: byPercentile((percentile) => worstOf(lastedAt(percentile)) === at),
      longestPart: longestPartOf(times.parts),
    };
  };

  return stages.map((stage, at) => ({
    kind: stage.kind,
    place: stage.place,
    times: {
      all: judged(stage.times.all, at, null),
      types: stage.times.types.map((each) => ({
        type: each.type,
        times: judged(each.times, at, each.type),
      })),
    },
  }));
};

const byText = (one: string, other: string): number =>
  one < other ? -1 : one > other ? 1 : 0;

export const shippedTaskIdsOf = (
  pullRequests: readonly TeamPullRequest[],
  period: InsightsPeriod,
): readonly string[] =>
  [
    ...new Set(
      mergedWithin(pullRequests, period.current).flatMap((each) =>
        each.by === 'spotlight' && each.taskId !== null ? [each.taskId] : [],
      ),
    ),
  ].sort(byText);

export const pipelineCountsOf = (
  history: TeamHistory,
  taskIds: readonly string[],
  period: InsightsPeriod,
): PipelineCounts => {
  const reach = period.lookback;
  const touched = openingsOf(history.touches);
  const openings = [...new Set(taskIds)].sort(byText).flatMap((taskId) => {
    const openedAt = touched.get(taskId)?.opening?.at ?? null;

    return openedAt !== null && openedAt.getTime() >= reach.from.getTime()
      ? [{ taskId, openedAt }]
      : [];
  });
  const tasks = new Set(openings.map((each) => each.taskId));
  const runs = history.records.filter(
    (each) => each.taskId && tasks.has(each.taskId.value) && each.end,
  );
  const waits = inboxWaitsWithin(history, reach);
  const stations = stationsOf(runs);
  const stationIds = stations.map((each) => each.stationId).sort(byText);

  return {
    openings,
    stations,
    passages: openings.flatMap(({ taskId }) =>
      stationIds.flatMap((stationId) => {
        const here = runs.filter(
          (run) =>
            run.taskId?.value === taskId &&
            run.end?.place.stationId === stationId,
        );

        return here.length > 0
          ? [
              {
                taskId,
                stationId,
                queued: sumOf(
                  known(here.map((run) => run.end?.queuedMs ?? null)),
                ),
                running: sumOf(
                  known(here.map((run) => run.end?.runningMs ?? null)),
                ),
                inbox: sumOf(
                  known(
                    waits
                      .filter(
                        (wait) =>
                          wait.taskId === taskId &&
                          wait.stationId === stationId,
                      )
                      .map((wait) => lasted(wait.askedAt, wait.answeredAt)),
                  ),
                ),
              },
            ]
          : [];
      }),
    ),
  };
};

const pipelineOf = (
  merged: readonly TeamPullRequest[],
  counts: PipelineCounts,
): PipelineFlow => {
  const openings = new Map(
    counts.openings.map((each) => [each.taskId, each.openedAt]),
  );
  const openedAt = (each: TeamPullRequest): Date | null =>
    openings.get(each.taskId ?? '') ?? null;
  const passages = new Map(
    counts.passages.map((each) => [
      JSON.stringify([each.taskId, each.stationId]),
      each,
    ]),
  );
  const made = merged.filter(
    (each) => each.by === 'spotlight' && openedAt(each) !== null,
  );
  const step = (
    each: TeamPullRequest,
    from: Date | null,
    to: Date | null,
  ): Passage => ({
    type: each.type,
    total: lasted(from, to),
    parts: null,
  });
  const stage = (
    kind: FlowStageKind,
    passages: readonly Passage[],
  ): Stage<Timed> => ({ kind, place: null, times: byTypeOf(passages) });

  const coding = stage(
    'coding',
    made.map((each) => step(each, openedAt(each), each.seen.openedAt)),
  );
  const stations = counts.stations.map(
    (place): Stage<Timed> => ({
      kind: 'station',
      place,
      times: byTypeOf(
        made.flatMap((each) => {
          const passage = passages.get(
            JSON.stringify([each.taskId, place.stationId]),
          );

          return passage
            ? [
                {
                  type: each.type,
                  total: passage.queued + passage.running + passage.inbox,
                  parts: {
                    queued: passage.queued,
                    running: passage.running,
                    inbox: passage.inbox,
                  },
                },
              ]
            : [];
        }),
        true,
      ),
    }),
  );
  const review = [
    stage(
      'awaitingReview',
      made.map((each) => ({
        type: each.type,
        total: toFirstReviewMs(each),
        parts: null,
      })),
    ),
    stage(
      'inReview',
      made.map((each) =>
        step(
          each,
          each.seen.firstUnblockingReviewAt,
          earliest(each.seen.firstApprovedAt, each.seen.closedAt),
        ),
      ),
    ),
    stage(
      'awaitingMerge',
      made.map((each) =>
        step(
          each,
          earliest(each.seen.firstApprovedAt, each.seen.closedAt),
          each.seen.closedAt,
        ),
      ),
    ),
  ];

  return {
    merged: made.length,
    types: PULL_REQUEST_TYPES.flatMap((type) => {
      const count = made.filter((each) => each.type === type).length;
      return count > 0 ? [{ type, merged: count }] : [];
    }),
    layouts: {
      stations: jammedOf([...stations, ...review]),
      stages: jammedOf([coding, ...review]),
    },
  };
};

export const shippingOf = (
  pullRequests: readonly TeamPullRequest[],
  counts: PipelineCounts,
  period: InsightsPeriod,
): Shipping => {
  const repositories = comparedRepositoriesOf(pullRequests, period.current);
  const compared = comparedOf(pullRequests, repositories);
  const merged = mergedWithin(compared, period.current);
  const reviewed = pullRequests.filter((each) => each.by !== 'bots');
  const toMerge = byAuthorOf(merged);
  const toMergeBefore = byAuthorOf(
    mergedWithin(
      comparedOf(
        pullRequests,
        comparedRepositoriesOf(pullRequests, period.previous),
      ),
      period.previous,
    ),
  );
  const types = typeMergesOf(merged);
  const depth = depthWeeksOf(compared, period.current);
  const reviewDays = reviewDaysOf(reviewed, period.days);
  const pipeline = pipelineOf(
    mergedWithin(pullRequests, period.current),
    counts,
  );

  return {
    toMerge,
    toMergeChanges: byAuthorChangesOf(toMerge, toMergeBefore),
    mergeDays: mergeDaysOf(compared, period.days),
    types,
    slowestFirst: slowestFirstOf(types),
    depth,
    depthTotals: depthTotalsOf(depth),
    reviewDays,
    bots: botsOf(pullRequests, period.current),
    pipeline,
    shippedAny:
      pipeline.merged > 0 ||
      types.length > 0 ||
      reviewDays.some((each) => each.awaiting > 0 || each.humanReviews > 0),
  };
};
