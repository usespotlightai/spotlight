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

export interface PullRequestFilterInput {
  readonly repositories: readonly string[] | null;
  readonly author: string | null;
  readonly type: string | null;
  readonly state: string | null;
  readonly week: string | null;
  readonly reverted: boolean;
  readonly rounds: string | null;
  readonly compared: boolean;
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

const oneOf = <T extends string>(
  values: readonly T[],
  query: string | null,
  what: string,
): T | null => {
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

const weekOf = (query: string | null): Window | null => {
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
  input: PullRequestFilterInput,
): PullRequestFilter => ({
  repositories: repositoriesOf(input.repositories),
  author: oneOf(PULL_REQUEST_AUTHORS, input.author, 'author'),
  type: oneOf(PULL_REQUEST_TYPES, input.type, 'type'),
  state: oneOf(PULL_REQUEST_STATES, input.state, 'state'),
  week: weekOf(input.week),
  reverted: input.reverted,
  rounds: oneOf(ROUND_BUCKETS, input.rounds, 'count of review rounds'),
  compared: input.compared,
});
