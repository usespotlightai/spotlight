import {
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

const mergedWithin = (
  pullRequests: readonly TeamPullRequest[],
  window: Window,
): readonly TeamPullRequest[] =>
  pullRequests.filter(
    (each) =>
      each.seen.state === 'merged' && within(window, each.seen.closedAt),
  );

const shareOf = (merged: readonly TeamPullRequest[]): Share => {
  const made = merged.filter((each) => each.by === 'spotlight').length;
  const touched = merged.filter((each) => each.by === 'touched').length;

  return {
    merged: merged.length,
    made,
    touched,
    bots: merged.filter((each) => each.by === 'bots').length,
    share: rateOf(made + touched, merged.length),
  };
};

const weeklyOf = (
  merged: readonly TeamPullRequest[],
  weeks: readonly string[],
): readonly WeekShare[] =>
  weeks.map((week) => ({
    week,
    ...shareOf(
      merged.filter((each) => within(weekWindowOf(week), each.seen.closedAt)),
    ),
  }));

const repositoriesOf = (
  teamRepositories: readonly string[],
  merged: readonly TeamPullRequest[],
): readonly string[] => {
  const named: string[] = [];

  for (const repository of [
    ...teamRepositories,
    ...merged.map((each) => each.seen.repository),
  ]) {
    if (!named.some((each) => sameRepository(each, repository))) {
      named.push(repository);
    }
  }

  return named;
};

export const penetrationOf = (
  pullRequests: readonly TeamPullRequest[],
  teamRepositories: readonly string[],
  window: Window,
): Penetration => {
  const merged = mergedWithin(pullRequests, window);
  const weeks = weeksOf(window);

  return {
    ...shareOf(merged),
    weeks: weeklyOf(merged, weeks),
    repositories: repositoriesOf(teamRepositories, merged)
      .map((repository) => {
        const here = merged.filter((each) =>
          sameRepository(each.seen.repository, repository),
        );

        return { repository, ...shareOf(here), weeks: weeklyOf(here, weeks) };
      })
      .sort(
        (a, b) =>
          b.merged - a.merged || a.repository.localeCompare(b.repository),
      ),
  };
};

const meanOf = (values: readonly number[]): number | null =>
  values.length > 0
    ? values.reduce((sum, each) => sum + each, 0) / values.length
    : null;

const known = (values: readonly (number | null)[]): number[] =>
  values.flatMap((each) => (each === null ? [] : [each]));

const measuresOf = (merged: readonly TeamPullRequest[]): GroupMeasures => {
  const reverts = merged.filter(reverted).length;

  return {
    merged: merged.length,
    toMerge: spreadOf(known(merged.map(toMergeMs))),
    inReview: spreadOf(known(merged.map(inReviewMs))),
    meanRounds: meanOf(merged.map((each) => each.seen.reviewRounds)),
    meanComments: meanOf(merged.map((each) => each.seen.reviewComments)),
    reverted: reverts,
    revertRate: rateOf(reverts, merged.length),
  };
};

const by = (
  pullRequests: readonly TeamPullRequest[],
  author: PullRequestAuthor,
): readonly TeamPullRequest[] =>
  pullRequests.filter((each) => each.by === author);

const comparedRepositories = (
  merged: readonly TeamPullRequest[],
): readonly string[] => repositoriesOf([], by(merged, 'spotlight'));

export const comparedRepositoriesOf = (
  pullRequests: readonly TeamPullRequest[],
  window: Window,
): readonly string[] =>
  comparedRepositories(mergedWithin(pullRequests, window));

const inRepositories = (
  pullRequests: readonly TeamPullRequest[],
  repositories: readonly string[],
): readonly TeamPullRequest[] =>
  pullRequests.filter((each) =>
    repositories.some((repository) =>
      sameRepository(repository, each.seen.repository),
    ),
  );

export const comparisonOf = (
  pullRequests: readonly TeamPullRequest[],
  window: Window,
): Comparison => {
  const merged = mergedWithin(pullRequests, window);
  const repositories = comparedRepositories(merged);

  return {
    repositories,
    spotlight: measuresOf(by(merged, 'spotlight')),
    people: measuresOf(inRepositories(by(merged, 'people'), repositories)),
  };
};

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

export const pullRequestInsightsOf = (
  pullRequests: readonly TeamPullRequest[],
  teamRepositories: readonly string[],
  window: Window,
): PullRequestInsights => ({
  weeks: weeksOf(window),
  penetration: penetrationOf(pullRequests, teamRepositories, window),
  comparison: comparisonOf(pullRequests, window),
  types: typesOf(pullRequests, window),
  depth: depthOf(pullRequests, window),
});
