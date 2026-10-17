import {
  byText,
  known,
  rateOf,
  type Spread,
  spendingOf,
  spreadOf,
} from '@outcomes/domain/services/measures';
import {
  inReviewMs,
  type PullRequestAuthor,
  ROUND_BUCKETS,
  type RoundBucket,
  reverted,
  roundBucketOf,
  type TeamPullRequest,
  toMergeMs,
} from '@outcomes/domain/services/team-pull-requests';
import {
  dayOf,
  type Window,
  within,
} from '@outcomes/domain/value-objects/insights-period.vo';
import {
  PULL_REQUEST_TYPES,
  type PullRequestType,
} from '@outcomes/domain/value-objects/pull-request-type';
import type { Spend } from '@outcomes/domain/value-objects/run-cost.vo';

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEK_MS = 7 * DAY_MS;

export interface Share {
  readonly merged: number;
  readonly made: number;
  readonly touched: number;
  readonly spotlight: number;
  readonly people: number;
  readonly bots: number;
  readonly share: number | null;
}

interface WeekShare extends Share {
  readonly week: string;
}

interface RepositoryPenetration extends Share {
  readonly repository: string;
  readonly weeks: readonly WeekShare[];
}

export interface Penetration extends Share {
  readonly weeks: readonly WeekShare[];
  readonly repositories: readonly RepositoryPenetration[];
}

export interface GroupMeasures {
  readonly merged: number;
  readonly toMerge: Spread;
  readonly inReview: Spread;
  readonly meanRounds: number | null;
  readonly meanComments: number | null;
  readonly reverted: number;
  readonly revertRate: number | null;
}

export interface Comparison {
  readonly repositories: readonly string[];
  readonly spotlight: GroupMeasures;
  readonly people: GroupMeasures;
}

export interface TypeShare {
  readonly type: PullRequestType;
  readonly spotlight: number;
  readonly people: number;
  readonly spend: Spend | null;
  readonly unpriced: number;
  readonly mixedCurrencies: boolean;
}

export interface RoundsShare {
  readonly rounds: RoundBucket;
  readonly spotlight: number;
  readonly people: number;
}

export interface PullRequestInsights {
  readonly weeks: readonly string[];
  readonly penetration: Penetration;
  readonly comparison: Comparison;
  readonly types: readonly TypeShare[];
  readonly depth: readonly RoundsShare[];
}

export interface MergedTally {
  readonly repository: string;
  readonly week: string;
  readonly by: PullRequestAuthor;
  readonly merged: number;
}

export interface MergedCounts {
  readonly merged: number;
  readonly toMerge: Spread;
  readonly inReview: Spread;
  readonly rounds: number;
  readonly comments: number;
  readonly reverted: number;
}

export interface PullRequestCounts {
  readonly covered: number;
  readonly tallies: readonly MergedTally[];
  readonly named: readonly string[];
  readonly compared: readonly string[];
  readonly spotlight: MergedCounts;
  readonly people: MergedCounts;
  readonly types: readonly TypeShare[];
  readonly depth: readonly RoundsShare[];
}

export const weekOf = (at: Date): string => {
  const midnight = Date.UTC(
    at.getUTCFullYear(),
    at.getUTCMonth(),
    at.getUTCDate(),
  );

  return dayOf(new Date(midnight - ((at.getUTCDay() + 6) % 7) * DAY_MS));
};

export const weekWindowOf = (week: string): Window => {
  const from = new Date(`${week}T00:00:00.000Z`);

  return { from, to: new Date(from.getTime() + WEEK_MS) };
};

export const weeksOf = (window: Window): readonly string[] => {
  const weeks: string[] = [];

  for (
    let at = weekWindowOf(weekOf(window.from)).from.getTime();
    at < window.to.getTime();
    at += WEEK_MS
  ) {
    weeks.push(dayOf(new Date(at)));
  }

  return weeks;
};

export const sameRepository = (one: string, other: string): boolean =>
  one.toLowerCase() === other.toLowerCase();

export const mergedWithin = (
  pullRequests: readonly TeamPullRequest[],
  window: Window,
): readonly TeamPullRequest[] =>
  pullRequests.filter(
    (each) =>
      each.seen.state === 'merged' && within(window, each.seen.closedAt),
  );

const shareOf = (tallies: readonly MergedTally[]): Share => {
  const of = (author: PullRequestAuthor): number =>
    tallies
      .filter((each) => each.by === author)
      .reduce((sum, each) => sum + each.merged, 0);
  const merged = tallies.reduce((sum, each) => sum + each.merged, 0);
  const made = of('spotlight');
  const touched = of('touched');

  return {
    merged,
    made,
    touched,
    spotlight: made + touched,
    people: of('people'),
    bots: of('bots'),
    share: rateOf(made + touched, merged),
  };
};

const weeklyOf = (
  tallies: readonly MergedTally[],
  weeks: readonly string[],
): readonly WeekShare[] =>
  weeks.map((week) => ({
    week,
    ...shareOf(tallies.filter((each) => each.week === week)),
  }));

const repositoriesOf = (repositories: readonly string[]): readonly string[] => {
  const named: string[] = [];

  for (const repository of repositories) {
    if (!named.some((each) => sameRepository(each, repository))) {
      named.push(repository);
    }
  }

  return named;
};

export const penetrationFrom = (
  counts: PullRequestCounts,
  teamRepositories: readonly string[],
  window: Window,
): Penetration => {
  const weeks = weeksOf(window);

  return {
    ...shareOf(counts.tallies),
    weeks: weeklyOf(counts.tallies, weeks),
    repositories: repositoriesOf([...teamRepositories, ...counts.named])
      .map((repository) => {
        const here = counts.tallies.filter(
          (each) => each.repository === repository.toLowerCase(),
        );

        return { repository, ...shareOf(here), weeks: weeklyOf(here, weeks) };
      })
      .sort(
        (a, b) =>
          b.merged - a.merged || a.repository.localeCompare(b.repository),
      ),
  };
};

const meanOf = (sum: number, count: number): number | null =>
  count > 0 ? sum / count : null;

const measuresFrom = (counts: MergedCounts): GroupMeasures => ({
  merged: counts.merged,
  toMerge: counts.toMerge,
  inReview: counts.inReview,
  meanRounds: meanOf(counts.rounds, counts.merged),
  meanComments: meanOf(counts.comments, counts.merged),
  reverted: counts.reverted,
  revertRate: rateOf(counts.reverted, counts.merged),
});

export const comparisonFrom = (counts: PullRequestCounts): Comparison => ({
  repositories: counts.compared,
  spotlight: measuresFrom(counts.spotlight),
  people: measuresFrom(counts.people),
});

const by = (
  pullRequests: readonly TeamPullRequest[],
  author: PullRequestAuthor,
): readonly TeamPullRequest[] =>
  pullRequests.filter((each) => each.by === author);

const namedIn = (merged: readonly TeamPullRequest[]): readonly string[] =>
  repositoriesOf(merged.map((each) => each.seen.repository));

const comparedRepositories = (
  merged: readonly TeamPullRequest[],
): readonly string[] => namedIn(by(merged, 'spotlight'));

export const comparedRepositoriesOf = (
  pullRequests: readonly TeamPullRequest[],
  window: Window,
): readonly string[] =>
  comparedRepositories(mergedWithin(pullRequests, window));

export const inRepositories = (
  pullRequests: readonly TeamPullRequest[],
  repositories: readonly string[],
): readonly TeamPullRequest[] =>
  pullRequests.filter((each) =>
    repositories.some((repository) =>
      sameRepository(repository, each.seen.repository),
    ),
  );

export const typesOf = (
  pullRequests: readonly TeamPullRequest[],
  window: Window,
): readonly TypeShare[] => {
  const merged = mergedWithin(pullRequests, window);
  const spotlight = by(merged, 'spotlight');
  const people = inRepositories(
    by(merged, 'people'),
    comparedRepositories(merged),
  );

  return PULL_REQUEST_TYPES.map((type) => {
    const made = spotlight.filter((each) => each.type === type);
    const spending = spendingOf(
      made.flatMap((each) =>
        each.spending.spend ? [each.spending.spend] : [],
      ),
    );

    return {
      type,
      spotlight: made.length,
      people: people.filter((each) => each.type === type).length,
      spend: spending.spend,
      unpriced: made.reduce((sum, each) => sum + each.spending.unpriced, 0),
      mixedCurrencies:
        spending.mixedCurrencies ||
        made.some((each) => each.spending.mixedCurrencies),
    };
  });
};

export const depthOf = (
  pullRequests: readonly TeamPullRequest[],
  window: Window,
): readonly RoundsShare[] => {
  const merged = mergedWithin(pullRequests, window);
  const repositories = comparedRepositories(merged);
  const spotlight = by(merged, 'spotlight');
  const people = inRepositories(by(merged, 'people'), repositories);
  const counted = (
    group: readonly TeamPullRequest[],
    rounds: RoundBucket,
  ): number =>
    group.filter((each) => roundBucketOf(each.seen.reviewRounds) === rounds)
      .length;

  return ROUND_BUCKETS.map((rounds) => ({
    rounds,
    spotlight: counted(spotlight, rounds),
    people: counted(people, rounds),
  }));
};

const talliesOf = (
  merged: readonly TeamPullRequest[],
): readonly MergedTally[] => {
  const tallies = new Map<string, MergedTally>();

  for (const each of merged) {
    if (each.seen.closedAt === null) {
      continue;
    }

    const repository = each.seen.repository.toLowerCase();
    const week = weekOf(each.seen.closedAt);
    const key = JSON.stringify([repository, week, each.by]);
    const tally = tallies.get(key);

    tallies.set(key, {
      repository,
      week,
      by: each.by,
      merged: (tally?.merged ?? 0) + 1,
    });
  }

  return [...tallies.values()].sort(
    (a, b) =>
      byText(a.repository, b.repository) ||
      byText(a.week, b.week) ||
      byText(a.by, b.by),
  );
};

const sumOf = (values: readonly number[]): number =>
  values.reduce((sum, each) => sum + each, 0);

const mergedCountsOf = (merged: readonly TeamPullRequest[]): MergedCounts => ({
  merged: merged.length,
  toMerge: spreadOf(known(merged.map(toMergeMs))),
  inReview: spreadOf(known(merged.map(inReviewMs))),
  rounds: sumOf(merged.map((each) => each.seen.reviewRounds)),
  comments: sumOf(merged.map((each) => each.seen.reviewComments)),
  reverted: merged.filter(reverted).length,
});

export const pullRequestCountsOf = (
  pullRequests: readonly TeamPullRequest[],
  window: Window,
): PullRequestCounts => {
  const merged = mergedWithin(pullRequests, window);
  const compared = comparedRepositories(merged);

  return {
    covered: pullRequests.length,
    tallies: talliesOf(merged),
    named: namedIn(merged),
    compared,
    spotlight: mergedCountsOf(by(merged, 'spotlight')),
    people: mergedCountsOf(inRepositories(by(merged, 'people'), compared)),
    types: typesOf(pullRequests, window),
    depth: depthOf(pullRequests, window),
  };
};

export const pullRequestInsightsFrom = (
  counts: PullRequestCounts,
  teamRepositories: readonly string[],
  window: Window,
): PullRequestInsights => ({
  weeks: weeksOf(window),
  penetration: penetrationFrom(counts, teamRepositories, window),
  comparison: comparisonFrom(counts),
  types: counts.types,
  depth: counts.depth,
});
