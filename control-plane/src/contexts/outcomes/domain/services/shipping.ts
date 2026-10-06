import type { BotActivity } from '@outcomes/domain/aggregates/pull-request-record.aggregate';
import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { inboxWaitsWithin } from '@outcomes/domain/services/flow';
import {
  between,
  known,
  type Percentiles,
  percentilesOf,
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

interface DepthWeek {
  readonly week: string;
  readonly merged: number;
  readonly rounds: Readonly<Record<RoundBucket, number>>;
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

interface StageParts {
  readonly queued: Percentiles;
  readonly running: Percentiles;
  readonly inbox: Percentiles;
}

export interface StageTimes {
  readonly total: Percentiles;
  readonly parts: StageParts | null;
}

export interface ByType {
  readonly all: StageTimes;
  readonly types: readonly {
    readonly type: PullRequestType;
    readonly times: StageTimes;
  }[];
}

interface StationStage extends StationPlace {
  readonly times: ByType;
}

interface PipelineFlow {
  readonly merged: number;
  readonly types: readonly {
    readonly type: PullRequestType;
    readonly merged: number;
  }[];
  readonly coding: ByType;
  readonly stations: readonly StationStage[];
  readonly review: {
    readonly awaitingReview: ByType;
    readonly inReview: ByType;
    readonly awaitingMerge: ByType;
  };
}

export interface Shipping {
  readonly toMerge: ByAuthor;
  readonly toMergeBefore: ByAuthor;
  readonly mergeDays: readonly MergeDay[];
  readonly types: readonly TypeMerge[];
  readonly depth: readonly DepthWeek[];
  readonly reviewDays: readonly ReviewDay[];
  readonly bots: readonly ReviewBot[];
  readonly pipeline: PipelineFlow;
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
      rounds: Object.fromEntries(
        ROUND_BUCKETS.map((rounds) => [
          rounds,
          merged.filter(
            (each) => roundBucketOf(each.seen.reviewRounds) === rounds,
          ).length,
        ]),
      ) as Record<RoundBucket, number>,
    };
  });

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

const timesOf = (
  passages: readonly Passage[],
  parted: boolean,
): StageTimes => ({
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

const byTypeOf = (passages: readonly Passage[], parted = false): ByType => {
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

const pipelineOf = (
  merged: readonly TeamPullRequest[],
  history: TeamHistory,
  reach: Window,
): PipelineFlow => {
  const openings = openingsOf(history.touches);
  const openedAt = (each: TeamPullRequest): Date | null =>
    openings.get(each.taskId ?? '')?.opening?.at ?? null;
  const made = merged.filter((each) => {
    const opened = openedAt(each);

    return (
      each.by === 'spotlight' &&
      opened !== null &&
      opened.getTime() >= reach.from.getTime()
    );
  });
  const tasks = new Set(made.map((each) => each.taskId));
  const runs = history.records.filter(
    (each) => each.taskId && tasks.has(each.taskId.value) && each.end,
  );
  const waits = inboxWaitsWithin(history, reach);
  const runsOf = (taskId: string | null): readonly RunRecord[] =>
    runs.filter((each) => each.taskId?.value === taskId);
  const step = (
    each: TeamPullRequest,
    from: Date | null,
    to: Date | null,
  ): Passage => ({
    type: each.type,
    total: lasted(from, to),
    parts: null,
  });

  return {
    merged: made.length,
    types: PULL_REQUEST_TYPES.flatMap((type) => {
      const count = made.filter((each) => each.type === type).length;
      return count > 0 ? [{ type, merged: count }] : [];
    }),
    coding: byTypeOf(
      made.map((each) => step(each, openedAt(each), each.seen.openedAt)),
    ),
    stations: stationsOf(runs).map((place) => ({
      ...place,
      times: byTypeOf(
        made.flatMap((each) => {
          const here = runsOf(each.taskId).filter(
            (run) => run.end?.place.stationId === place.stationId,
          );

          if (here.length === 0) {
            return [];
          }

          const queued = sumOf(
            known(here.map((run) => run.end?.queuedMs ?? null)),
          );
          const running = sumOf(
            known(here.map((run) => run.end?.runningMs ?? null)),
          );
          const inbox = sumOf(
            known(
              waits
                .filter(
                  (wait) =>
                    wait.taskId === each.taskId &&
                    wait.stationId === place.stationId,
                )
                .map((wait) => lasted(wait.askedAt, wait.answeredAt)),
            ),
          );

          return [
            {
              type: each.type,
              total: queued + running + inbox,
              parts: { queued, running, inbox },
            },
          ];
        }),
        true,
      ),
    })),
    review: {
      awaitingReview: byTypeOf(
        made.map((each) => ({
          type: each.type,
          total: toFirstReviewMs(each),
          parts: null,
        })),
      ),
      inReview: byTypeOf(
        made.map((each) =>
          step(
            each,
            each.seen.firstUnblockingReviewAt,
            earliest(each.seen.firstApprovedAt, each.seen.closedAt),
          ),
        ),
      ),
      awaitingMerge: byTypeOf(
        made.map((each) =>
          step(
            each,
            earliest(each.seen.firstApprovedAt, each.seen.closedAt),
            each.seen.closedAt,
          ),
        ),
      ),
    },
  };
};

export const shippingOf = (
  pullRequests: readonly TeamPullRequest[],
  history: TeamHistory,
  period: InsightsPeriod,
): Shipping => {
  const repositories = comparedRepositoriesOf(pullRequests, period.current);
  const compared = comparedOf(pullRequests, repositories);
  const merged = mergedWithin(compared, period.current);
  const reviewed = pullRequests.filter((each) => each.by !== 'bots');

  return {
    toMerge: byAuthorOf(merged),
    toMergeBefore: byAuthorOf(
      mergedWithin(
        comparedOf(
          pullRequests,
          comparedRepositoriesOf(pullRequests, period.previous),
        ),
        period.previous,
      ),
    ),
    mergeDays: mergeDaysOf(compared, period.days),
    types: typeMergesOf(merged),
    depth: depthWeeksOf(compared, period.current),
    reviewDays: reviewDaysOf(reviewed, period.days),
    bots: botsOf(pullRequests, period.current),
    pipeline: pipelineOf(
      mergedWithin(pullRequests, period.current),
      history,
      period.lookback,
    ),
  };
};
