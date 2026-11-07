import { InvalidPullRequestFilterError } from '@insights/domain/exceptions/invalid-pull-request-filter.error';
import { weekWindowOf } from '@insights/domain/services/pull-request-insights';
import {
  PULL_REQUEST_AUTHORS,
  type PullRequestAuthor,
  ROUND_BUCKETS,
  type RoundBucket,
} from '@insights/domain/services/team-pull-requests';
import { type Window } from '@insights/domain/value-objects/insights-period.vo';
import {
  PULL_REQUEST_STATES,
  type PullRequestState,
} from '@insights/domain/value-objects/pull-request-state';
import {
  PULL_REQUEST_TYPES,
  type PullRequestType,
} from '@insights/domain/value-objects/pull-request-type';

export const MAX_FILTERED_REPOSITORIES = 50;

type QueryValue = string | readonly string[] | null;

export interface PullRequestFilterQuery {
  readonly repository: readonly string[] | null;
  readonly author: QueryValue;
  readonly type: QueryValue;
  readonly state: QueryValue;
  readonly week: QueryValue;
  readonly reverted: QueryValue;
  readonly rounds: QueryValue;
  readonly compared: QueryValue;
}

export interface PullRequestFilter {
  readonly repositories: readonly string[] | null;
  readonly author: PullRequestAuthor | null;
  readonly type: PullRequestType | null;
  readonly state: PullRequestState | null;
  readonly week: Window | null;
  readonly reverted: boolean;
  readonly rounds: RoundBucket | null;
  readonly compared: boolean;
}

const WEEK = /^\d{4}-\d{2}-\d{2}$/;

const FLAGS = ['true', 'false'] as const;

const single = (query: QueryValue, what: string): string | null => {
  if (typeof query === 'string' || query === null) {
    return query;
  }

  throw new InvalidPullRequestFilterError(
    `takes one ${what}, not ${query.length}`,
  );
};

const oneOf = <T extends string>(
  values: readonly T[],
  value: QueryValue,
  what: string,
): T | null => {
  const query = single(value, what);

  if (query === null) {
    return null;
  }

  const found = values.find((each) => each === query);

  if (!found) {
    throw new InvalidPullRequestFilterError(
      `${what} must be one of ${values.join(', ')}, not ${query}`,
    );
  }

  return found;
};

const flagOf = (query: QueryValue, what: string): boolean =>
  oneOf(FLAGS, query, what) === 'true';

const weekOf = (value: QueryValue): Window | null => {
  const query = single(value, 'week');

  if (query === null) {
    return null;
  }

  const window = WEEK.test(query) ? weekWindowOf(query) : null;

  if (!window || Number.isNaN(window.from.getTime())) {
    throw new InvalidPullRequestFilterError(
      `week must be a date in the form YYYY-MM-DD, not ${query}`,
    );
  }

  return window;
};

const repositoriesOf = (
  query: readonly string[] | null,
): readonly string[] | null => {
  if (query !== null && query.length > MAX_FILTERED_REPOSITORIES) {
    throw new InvalidPullRequestFilterError(
      `takes at most ${MAX_FILTERED_REPOSITORIES} repositories`,
    );
  }

  return query;
};

export const pullRequestFilterOf = (
  query: PullRequestFilterQuery,
): PullRequestFilter => ({
  repositories: repositoriesOf(query.repository),
  author: oneOf(PULL_REQUEST_AUTHORS, query.author, 'author'),
  type: oneOf(PULL_REQUEST_TYPES, query.type, 'type'),
  state: oneOf(PULL_REQUEST_STATES, query.state, 'state'),
  week: weekOf(query.week),
  reverted: flagOf(query.reverted, 'reverted'),
  rounds: oneOf(ROUND_BUCKETS, query.rounds, 'count of review rounds'),
  compared: flagOf(query.compared, 'compared'),
});
