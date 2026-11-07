import { rateOf, type Spread } from '@insights/domain/services/measures';
import {
  type PullRequestAuthor,
  type RoundBucket,
  type TeamPullRequest,
} from '@insights/domain/services/team-pull-requests';
import {
  dayOf,
  type Window,
} from '@insights/domain/value-objects/insights-period.vo';
import { type PullRequestType } from '@insights/domain/value-objects/pull-request-type';
import type { Money } from '@insights/domain/value-objects/run-usage.vo';

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEK_MS = 7 * DAY_MS;

export interface Share {
  readonly merged: number;
  readonly authored: number;
  readonly reviewed: number;
  readonly spotlight: number;
  readonly people: number;
  readonly bots: number;
  readonly rate: number | null;
}

interface WeekShare extends Share {
  readonly week: string;
}

interface RepositorySpotlightShare extends Share {
  readonly repository: string;
  readonly weeks: readonly WeekShare[];
}

export interface SpotlightShare extends Share {
  readonly weeks: readonly WeekShare[];
  readonly repositories: readonly RepositorySpotlightShare[];
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
  readonly spend: Money | null;
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
  readonly spotlightShare: SpotlightShare;
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

const shareOf = (tallies: readonly MergedTally[]): Share => {
  const of = (author: PullRequestAuthor): number =>
    tallies
      .filter((each) => each.by === author)
      .reduce((sum, each) => sum + each.merged, 0);
  const merged = tallies.reduce((sum, each) => sum + each.merged, 0);
  const authored = of('spotlight');
  const reviewed = of('reviewed');

  return {
    merged,
    authored,
    reviewed,
    spotlight: authored + reviewed,
    people: of('people'),
    bots: of('bots'),
    rate: rateOf(authored + reviewed, merged),
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

export const spotlightShareFrom = (
  counts: PullRequestCounts,
  teamRepositories: readonly string[],
  window: Window,
): SpotlightShare => {
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

const _by = (
  pullRequests: readonly TeamPullRequest[],
  author: PullRequestAuthor,
): readonly TeamPullRequest[] =>
  pullRequests.filter((each) => each.by === author);

export const pullRequestInsightsFrom = (
  counts: PullRequestCounts,
  teamRepositories: readonly string[],
  window: Window,
): PullRequestInsights => ({
  weeks: weeksOf(window),
  spotlightShare: spotlightShareFrom(counts, teamRepositories, window),
  comparison: comparisonFrom(counts),
  types: counts.types,
  depth: counts.depth,
});
