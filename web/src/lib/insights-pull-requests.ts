import type {
  GroupMeasuresResponseDto,
  InsightsPullRequestListResponseDto,
  InsightsPullRequestResponseDto,
  InsightsPullRequestsResponseDto,
  RepositorySpotlightShareResponseDto,
  RoundsShareResponseDto,
  TypeShareResponseDto,
  WeekShareResponseDto,
} from '@/lib/api';

export type InsightsPullRequests = InsightsPullRequestsResponseDto;
export type InsightsPullRequestList = InsightsPullRequestListResponseDto;
export type InsightsPullRequest = InsightsPullRequestResponseDto;
export type WeekShare = WeekShareResponseDto;
export type RepositorySpotlightShare = RepositorySpotlightShareResponseDto;
export type GroupMeasures = GroupMeasuresResponseDto;
export type TypeShare = TypeShareResponseDto;
export type RoundsShare = RoundsShareResponseDto;

export type PullRequestAuthor = InsightsPullRequest['by'];
export type PullRequestType = InsightsPullRequest['type'];
export type PullRequestState = InsightsPullRequest['state'];
export type RoundBucket = RoundsShare['rounds'];

export const PULL_REQUEST_AUTHORS: readonly PullRequestAuthor[] = [
  'spotlight',
  'reviewed',
  'people',
  'bots',
];

export const PULL_REQUEST_TYPES: readonly PullRequestType[] = [
  'feature',
  'fix',
  'refactor',
  'tests',
  'chore',
  'other',
];

export const PULL_REQUEST_STATES: readonly PullRequestState[] = [
  'merged',
  'closed',
  'open',
];

const ROUND_BUCKETS: readonly RoundBucket[] = ['0', '1', '2', '3+'];

const MAX_REPOSITORIES = 50;

const WEEK = /^\d{4}-\d{2}-\d{2}$/;

export const PULL_REQUEST_FILTER_KEYS = [
  'repository',
  'author',
  'type',
  'state',
  'week',
  'reverted',
  'rounds',
  'compared',
] as const;

export type PullRequestFilterKey = (typeof PULL_REQUEST_FILTER_KEYS)[number];

export type PullRequestFilter = {
  readonly [key in PullRequestFilterKey]?: string;
};

const valid = (key: PullRequestFilterKey, value: string): boolean => {
  switch (key) {
    case 'author':
      return PULL_REQUEST_AUTHORS.includes(value as PullRequestAuthor);
    case 'type':
      return PULL_REQUEST_TYPES.includes(value as PullRequestType);
    case 'state':
      return PULL_REQUEST_STATES.includes(value as PullRequestState);
    case 'rounds':
      return ROUND_BUCKETS.includes(value as RoundBucket);
    case 'reverted':
    case 'compared':
      return value === 'true';
    case 'week':
      return WEEK.test(value);
    case 'repository':
      return value.split(',').filter(Boolean).length <= MAX_REPOSITORIES;
  }
};

export const pullRequestFilterOf = (
  params: URLSearchParams,
): PullRequestFilter =>
  Object.fromEntries(
    PULL_REQUEST_FILTER_KEYS.flatMap((key) => {
      const value = params.get(key);

      return value && valid(key, value) ? [[key, value] as const] : [];
    }),
  );

export const pullRequestsNarrowedBy = (
  filter: PullRequestFilter,
): PullRequestFilterKey[] =>
  PULL_REQUEST_FILTER_KEYS.filter((key) => Boolean(filter[key]));

const AUTHORS: Record<PullRequestAuthor, string> = {
  spotlight: 'Spotlight',
  reviewed: 'Others, with a Spotlight review task',
  people: 'People alone',
  bots: 'Bots alone',
};

const TYPES: Record<PullRequestType, string> = {
  feature: 'Feature',
  fix: 'Fix',
  refactor: 'Refactor',
  tests: 'Tests',
  chore: 'Chore',
  other: 'Other',
};

const STATES: Record<PullRequestState, string> = {
  merged: 'Merged',
  closed: 'Closed unmerged',
  open: 'Open',
};

const ROUNDS: Record<RoundBucket, string> = {
  '0': 'No rounds',
  '1': '1 round',
  '2': '2 rounds',
  '3+': '3 or more rounds',
};

const FILTER_LABELS: Record<PullRequestFilterKey, string> = {
  repository: 'Repository',
  author: 'Written by',
  type: 'Type',
  state: 'State',
  week: 'Week of',
  reverted: 'Reverted',
  rounds: 'Review rounds',
  compared: 'Repositories',
};

export const formatAuthor = (author: PullRequestAuthor): string =>
  AUTHORS[author];

export const formatType = (type: PullRequestType): string => TYPES[type];

export const formatState = (state: PullRequestState): string => STATES[state];

export const formatRounds = (rounds: RoundBucket): string => ROUNDS[rounds];

export const pullRequestFilterLabel = (key: PullRequestFilterKey): string =>
  FILTER_LABELS[key];

export const formatPullRequestFilterValue = (
  key: PullRequestFilterKey,
  value: string,
): string => {
  switch (key) {
    case 'author':
      return AUTHORS[value as PullRequestAuthor] ?? value;
    case 'type':
      return TYPES[value as PullRequestType] ?? value;
    case 'state':
      return STATES[value as PullRequestState] ?? value;
    case 'rounds':
      return ROUNDS[value as RoundBucket] ?? value;
    case 'reverted':
      return 'Yes';
    case 'compared':
      return 'Where Spotlight merged';
    case 'repository': {
      const named = value.split(',').filter(Boolean);
      return named.length === 1
        ? (named[0] ?? value)
        : `${named.length} repositories`;
    }
    default:
      return value;
  }
};

const repositoriesFilter = (
  repositories: readonly string[],
): PullRequestFilter => {
  if (repositories.length === 0) {
    return {};
  }

  return repositories.length <= MAX_REPOSITORIES
    ? { repository: repositories.join(',') }
    : { compared: 'true' };
};

export const mergedPullRequestsFilter = (
  narrowed: PullRequestFilter = {},
): PullRequestFilter => ({ state: 'merged', ...narrowed });

export const weekFilter = (
  week: string,
  repository: string | null,
  author?: PullRequestAuthor,
): PullRequestFilter =>
  mergedPullRequestsFilter({
    week,
    ...(repository ? { repository } : {}),
    ...(author ? { author } : {}),
  });

export const groupFilter = (
  author: PullRequestAuthor,
  repositories: readonly string[],
  narrowed: PullRequestFilter = {},
): PullRequestFilter =>
  mergedPullRequestsFilter({
    author,
    ...(author === 'people' ? repositoriesFilter(repositories) : {}),
    ...narrowed,
  });

export const typeFilter = (
  type: PullRequestType,
  author: PullRequestAuthor,
): PullRequestFilter => mergedPullRequestsFilter({ type, author });

export const formatMean = (mean: number | null): string =>
  mean === null ? '–' : mean.toFixed(1);

export const formatSize = (pullRequest: InsightsPullRequest): string =>
  pullRequest.additions === null || pullRequest.deletions === null
    ? '–'
    : `+${pullRequest.additions.toLocaleString()} −${pullRequest.deletions.toLocaleString()}`;

export const PULL_REQUESTS_LIST_ID = 'pull-request-list';

export const SPOTLIGHT_COMPARED_WITH_PEOPLE =
  'Compares Spotlight’s pull requests with pull requests by people alone, in repositories where Spotlight merged.';

export const PULL_REQUEST_TYPE_SOURCE =
  'The type comes from the change stack. Without one, it comes from the title and branch.';
