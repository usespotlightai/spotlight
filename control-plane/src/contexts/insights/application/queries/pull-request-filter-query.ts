import { InvalidPullRequestFilterError } from '@insights/domain/exceptions/invalid-pull-request-filter.error';
import type { PullRequestFilterInput } from '@insights/domain/services/pull-request-filter';

const FLAGS = ['true', 'false'] as const;

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

const single = (query: QueryValue, what: string): string | null => {
  if (typeof query === 'string' || query === null) {
    return query;
  }

  throw new InvalidPullRequestFilterError(
    `takes one ${what}, not ${query.length}`,
  );
};

const flagOf = (value: QueryValue, what: string): boolean => {
  const query = single(value, what);

  if (query !== null && !FLAGS.some((each) => each === query)) {
    throw new InvalidPullRequestFilterError(
      `${what} must be one of ${FLAGS.join(', ')}, not ${query}`,
    );
  }

  return query === 'true';
};

export const pullRequestFilterInputOf = (
  query: PullRequestFilterQuery,
): PullRequestFilterInput => ({
  repositories: query.repository,
  author: single(query.author, 'author'),
  type: single(query.type, 'type'),
  state: single(query.state, 'state'),
  week: single(query.week, 'week'),
  reverted: flagOf(query.reverted, 'reverted'),
  rounds: single(query.rounds, 'count of review rounds'),
  compared: flagOf(query.compared, 'compared'),
});
