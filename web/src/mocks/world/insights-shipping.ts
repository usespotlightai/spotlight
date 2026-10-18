import type {
  ByAuthorChangesResponseDto,
  ByAuthorResponseDto,
  ByTypeResponseDto,
  FlowStageResponseDto,
  InsightsShippingResponseDto,
  PercentilesResponseDto,
  ReviewBotResponseDto,
  StageTimesResponseDto,
} from '@/lib/api';
import {
  PULL_REQUEST_TYPES,
  type PullRequestType,
} from '@/lib/insights-pull-requests';
import {
  PERCENTILES,
  type Percentile,
  ROUNDS,
  type StationStage,
} from '@/lib/insights-shipping';
import { type HistoryRun, history } from '@/mocks/world/insights-history';
import {
  changeOf,
  DAY_MS,
  mondaysOf,
  type PeriodName,
  quantile,
  shareOf,
  spanOf,
  sumOf,
  type Window,
  weekOf,
  within,
} from '@/mocks/world/insights-measures';
import {
  mergedIn,
  type PullRequestFact,
  pullRequestFacts,
  roundsOf,
  toMergeOf,
} from '@/mocks/world/insights-pull-requests';
import { profilesOfTeam } from '@/mocks/world/insights-tally';

const PERCENTILE_MS = {
  p50: 'p50Ms',
  p75: 'p75Ms',
  p90: 'p90Ms',
  p95: 'p95Ms',
} as const;

const percentilesOf = (values: readonly number[]): PercentilesResponseDto => ({
  p50Ms: quantile(values, 0.5),
  p75Ms: quantile(values, 0.75),
  p90Ms: quantile(values, 0.9),
  p95Ms: quantile(values, 0.95),
  count: values.length,
});

const isSpotlight = (fact: PullRequestFact) => fact.by === 'spotlight';

const isPeople = (fact: PullRequestFact) =>
  fact.by === 'people' || fact.by === 'reviewed';

const durations = (facts: readonly PullRequestFact[]): number[] =>
  facts.flatMap((fact) => {
    const took = toMergeOf(fact);
    return took === null ? [] : [took];
  });

const byAuthor = (facts: readonly PullRequestFact[]): ByAuthorResponseDto => ({
  spotlight: percentilesOf(durations(facts.filter(isSpotlight))),
  people: percentilesOf(durations(facts.filter(isPeople))),
});

const changesOf = (
  now: ByAuthorResponseDto,
  before: ByAuthorResponseDto,
): ByAuthorChangesResponseDto => {
  const of = (author: 'spotlight' | 'people') =>
    Object.fromEntries(
      PERCENTILES.map((percentile) => [
        percentile,
        changeOf(
          now[author][PERCENTILE_MS[percentile]],
          before[author][PERCENTILE_MS[percentile]],
          'down',
        ),
      ]),
    ) as ByAuthorChangesResponseDto['spotlight'];

  return { spotlight: of('spotlight'), people: of('people') };
};

const dayWindow = (day: string): Window => {
  const from = Date.parse(`${day}T00:00:00.000Z`);
  return { from, to: from + DAY_MS };
};

const weekEnding = (day: string): Window => {
  const { to } = dayWindow(day);
  return { from: to - 7 * DAY_MS, to };
};

const roundsCounts = (facts: readonly PullRequestFact[]) =>
  ROUNDS.map((rounds) => {
    const merged = facts.filter((fact) => roundsOf(fact) === rounds).length;
    return { rounds, merged, rate: shareOf(merged, facts.length) };
  });

type Sample = { readonly type: PullRequestType; readonly ms: number };

type PartSamples = Record<StationStage, Sample[]>;

const UNJUDGED = { p50: 0, p75: 0, p90: 0, p95: 0 };

const NOT_WORST = { p50: false, p75: false, p90: false, p95: false };

const timesOf = (
  total: readonly number[],
  parts: Record<StationStage, readonly number[]> | null,
): StageTimesResponseDto => {
  const partTimes = parts && {
    queued: percentilesOf(parts.queued),
    running: percentilesOf(parts.running),
    inbox: percentilesOf(parts.inbox),
  };
  const longest = (percentile: Percentile) =>
    (['queued', 'running', 'inbox'] as const).reduce<StationStage>(
      (max, part) =>
        (partTimes?.[part][PERCENTILE_MS[percentile]] ?? 0) >
        (partTimes?.[max][PERCENTILE_MS[percentile]] ?? 0)
          ? part
          : max,
      'queued',
    );

  return {
    total: percentilesOf(total),
    parts: partTimes,
    bottleneckRatio: UNJUDGED,
    worst: NOT_WORST,
    longestPart: partTimes
      ? {
          p50: longest('p50'),
          p75: longest('p75'),
          p90: longest('p90'),
          p95: longest('p95'),
        }
      : null,
  };
};

const byType = (
  total: readonly Sample[],
  parts: PartSamples | null,
): ByTypeResponseDto => {
  const msOf = (samples: readonly Sample[], type?: PullRequestType) =>
    samples
      .filter((sample) => type === undefined || sample.type === type)
      .map((sample) => sample.ms);
  const partsOf = (type?: PullRequestType) =>
    parts && {
      queued: msOf(parts.queued, type),
      running: msOf(parts.running, type),
      inbox: msOf(parts.inbox, type),
    };

  return {
    all: timesOf(msOf(total), partsOf()),
    types: PULL_REQUEST_TYPES.filter((type) =>
      total.some((sample) => sample.type === type),
    ).map((type) => ({
      type,
      times: timesOf(msOf(total, type), partsOf(type)),
    })),
  };
};

const withBottleneckRatios = (
  stages: readonly FlowStageResponseDto[],
): FlowStageResponseDto[] => {
  const totalOf = (
    stage: FlowStageResponseDto,
    percentile: Percentile,
    type: PullRequestType | null,
  ) =>
    (type
      ? stage.times.types.find((each) => each.type === type)?.times
      : stage.times.all
    )?.total[PERCENTILE_MS[percentile]] ?? 0;
  const judged = (
    times: StageTimesResponseDto,
    at: number,
    type: PullRequestType | null,
  ): StageTimesResponseDto => {
    const of = <T>(each: (lasted: number[]) => T) =>
      Object.fromEntries(
        PERCENTILES.map((percentile) => [
          percentile,
          each(stages.map((stage) => totalOf(stage, percentile, type))),
        ]),
      ) as Record<Percentile, T>;

    return {
      ...times,
      bottleneckRatio: of((lasted) => {
        const max = Math.max(0, ...lasted);
        return max === 0 ? 0 : (lasted[at] ?? 0) / max;
      }),
      worst: of((lasted) => lasted.indexOf(Math.max(...lasted)) === at),
    };
  };

  return stages.map((stage, at) => ({
    ...stage,
    times: {
      all: judged(stage.times.all, at, null),
      types: stage.times.types.map((each) => ({
        type: each.type,
        times: judged(each.times, at, each.type),
      })),
    },
  }));
};

const reviewStages = (merged: readonly PullRequestFact[]) => {
  const samples = (ms: (fact: PullRequestFact) => number | null) =>
    merged.flatMap((fact) => {
      const value = ms(fact);
      return value === null ? [] : [{ type: fact.type, ms: value }];
    });
  const inReview = (fact: PullRequestFact) =>
    fact.firstReviewAt && fact.closedAt
      ? fact.closedAt - fact.firstReviewAt
      : null;
  const awaitingMerge = (fact: PullRequestFact) => {
    const reviewing = inReview(fact);
    return reviewing === null
      ? null
      : Math.min(reviewing * 0.15, 2 * 3_600_000);
  };
  const stage = (
    kind: FlowStageResponseDto['kind'],
    ms: (fact: PullRequestFact) => number | null,
  ): FlowStageResponseDto => ({
    kind,
    lineId: null,
    stationId: null,
    times: byType(samples(ms), null),
  });

  return [
    stage('awaitingReview', (fact) =>
      fact.firstReviewAt ? fact.firstReviewAt - fact.openedAt : null,
    ),
    stage('inReview', (fact) => {
      const reviewing = inReview(fact);
      return reviewing === null ? null : reviewing - (awaitingMerge(fact) ?? 0);
    }),
    stage('awaitingMerge', awaitingMerge),
  ];
};

const stationStages = (
  teamId: string,
  merged: readonly PullRequestFact[],
): FlowStageResponseDto[] => {
  const runsByTask = new Map<string, HistoryRun[]>();
  for (const run of history().runs) {
    runsByTask.set(run.taskId, [...(runsByTask.get(run.taskId) ?? []), run]);
  }

  return profilesOfTeam(teamId).flatMap((profile) => {
    const total: Sample[] = [];
    const parts: PartSamples = { queued: [], running: [], inbox: [] };
    for (const fact of merged) {
      const runs = (runsByTask.get(fact.taskId ?? '') ?? []).filter(
        (run) => run.stationId === profile.stationId,
      );
      if (runs.length === 0) {
        continue;
      }
      const queued = sumOf(runs.map((run) => run.queuedMs ?? 0));
      const running = sumOf(runs.map((run) => run.runningMs ?? 0));
      const inbox = sumOf(
        runs.map((run) =>
          run.firstHumanAction
            ? Date.parse(run.firstHumanAction.at) - run.at
            : 0,
        ),
      );
      total.push({ type: fact.type, ms: queued + running + inbox });
      parts.queued.push({ type: fact.type, ms: queued });
      parts.running.push({ type: fact.type, ms: running });
      parts.inbox.push({ type: fact.type, ms: inbox });
    }

    return total.length === 0
      ? []
      : [
          {
            kind: 'station' as const,
            lineId: profile.lineId,
            stationId: profile.stationId,
            times: byType(total, parts),
          },
        ];
  });
};

const codingStage = (
  teamId: string,
  merged: readonly PullRequestFact[],
): FlowStageResponseDto => {
  const tasks = new Map(
    history()
      .tasks.filter((task) => task.teamId === teamId)
      .map((task) => [task.id, task]),
  );

  return {
    kind: 'coding',
    lineId: null,
    stationId: null,
    times: byType(
      merged.flatMap((fact) => {
        const task = tasks.get(fact.taskId ?? '');
        return task
          ? [{ type: fact.type, ms: fact.openedAt - task.openedAt }]
          : [];
      }),
      null,
    ),
  };
};

const BOTS: readonly (readonly [string, number, number, number])[] = [
  ['coderabbitai[bot]', 7.1, 1, 0.18],
  ['acme-spotlight[bot]', 3.2, 0.7, 0.61],
  ['copilot-pull-request-reviewer[bot]', 1.8, 0.5, 0.34],
];

const botsOf = (active: number): ReviewBotResponseDto[] =>
  active === 0
    ? []
    : BOTS.map(([login, comments, reviews, resolvedRate]) => ({
        login,
        comments: Math.round(comments * active),
        reviews: Math.round(reviews * active),
        resolvedRate,
      }));

export const shippingOf = (
  teamId: string,
  name: PeriodName,
): InsightsShippingResponseDto => {
  const span = spanOf(name);
  const facts = pullRequestFacts(teamId).filter((fact) => fact.by !== 'bots');
  const merged = mergedIn(facts, span.now);
  const toMerge = byAuthor(merged);
  const types = PULL_REQUEST_TYPES.flatMap((type) => {
    const ofType = merged.filter((fact) => fact.type === type);
    return ofType.length === 0
      ? []
      : [{ type, merged: ofType.length, toMerge: byAuthor(ofType) }];
  });
  const slowest = (percentile: Percentile) =>
    [...types]
      .sort(
        (one, other) =>
          (other.toMerge.spotlight[PERCENTILE_MS[percentile]] ?? 0) -
          (one.toMerge.spotlight[PERCENTILE_MS[percentile]] ?? 0),
      )
      .map((each) => each.type);
  const spotlightMerged = merged.filter(isSpotlight);
  const reviewStagesNow = reviewStages(spotlightMerged);
  const active = facts.filter(
    (fact) =>
      fact.openedAt < span.now.to &&
      (fact.closedAt === null || fact.closedAt >= span.now.from),
  ).length;

  return {
    period: span.period,
    toMerge,
    toMergeChanges: changesOf(toMerge, byAuthor(mergedIn(facts, span.before))),
    mergeDays:
      merged.length === 0
        ? []
        : span.period.days.map((day) => ({
            day,
            daily: byAuthor(mergedIn(facts, dayWindow(day))),
            rolling: byAuthor(mergedIn(facts, weekEnding(day))),
          })),
    types,
    slowestFirst: {
      p50: slowest('p50'),
      p75: slowest('p75'),
      p90: slowest('p90'),
      p95: slowest('p95'),
    },
    depth:
      merged.length === 0
        ? []
        : mondaysOf(span).map((week) => {
            const inWeek = merged.filter(
              (fact) => weekOf(fact.closedAt ?? 0) === week,
            );
            return {
              week,
              merged: inWeek.length,
              rounds: roundsCounts(inWeek),
            };
          }),
    depthTotals: roundsCounts(merged),
    reviewDays:
      merged.length === 0
        ? []
        : span.period.days.map((day) => {
            const window = dayWindow(day);
            const firstReviewed = (inWindow: Window) =>
              facts.flatMap((fact) =>
                fact.firstReviewAt && within(fact.firstReviewAt, inWindow)
                  ? [fact.firstReviewAt - fact.openedAt]
                  : [],
              );
            return {
              day,
              toFirstReviewDaily: percentilesOf(firstReviewed(window)),
              toFirstReviewRolling: percentilesOf(
                firstReviewed(weekEnding(day)),
              ),
              awaiting: facts.filter(
                (fact) =>
                  fact.openedAt < window.to &&
                  (fact.firstReviewAt === null ||
                    fact.firstReviewAt >= window.to) &&
                  (fact.closedAt === null || fact.closedAt >= window.to),
              ).length,
              humanReviews: sumOf(
                facts
                  .filter(
                    (fact) =>
                      fact.firstReviewAt && within(fact.firstReviewAt, window),
                  )
                  .map((fact) => Math.max(1, fact.reviewRounds)),
              ),
            };
          }),
    pipeline: {
      merged: spotlightMerged.length,
      types: PULL_REQUEST_TYPES.flatMap((type) => {
        const count = spotlightMerged.filter(
          (fact) => fact.type === type,
        ).length;
        return count === 0 ? [] : [{ type, merged: count }];
      }),
      layouts: {
        stations: withBottleneckRatios([
          ...stationStages(teamId, spotlightMerged),
          ...reviewStagesNow,
        ]),
        stages: withBottleneckRatios([
          codingStage(teamId, spotlightMerged),
          ...reviewStagesNow,
        ]),
      },
    },
    shippedAny: spotlightMerged.length > 0,
    bots: botsOf(active),
  };
};
