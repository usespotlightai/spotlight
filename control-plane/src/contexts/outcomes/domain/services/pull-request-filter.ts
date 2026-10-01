import { InvalidPullRequestFilterError } from '@outcomes/domain/exceptions/invalid-pull-request-filter.error';
import {
  comparedRepositoriesOf,
  sameRepository,
  weekWindowOf,
} from '@outcomes/domain/services/pull-request-insights';
import {
  PULL_REQUEST_AUTHORS,
  type PullRequestAuthor,
  ROUND_BUCKETS,
  type RoundBucket,
  reverted,
  roundBucketOf,
  type TeamPullRequest,
} from '@outcomes/domain/services/team-pull-requests';
import {
  DELIVERY_STATES,
  type DeliveryState,
} from '@outcomes/domain/value-objects/delivery-state';
import {
  type Window,
  within,
} from '@outcomes/domain/value-objects/insights-period.vo';
import {
  PULL_REQUEST_TYPES,
  type PullRequestType,
} from '@outcomes/domain/value-objects/pull-request-type';

export const MOST_FILTERED_REPOSITORIES = 50;

type AskedValue = string | readonly string[] | null;

export interface PullRequestFilterAsked {
  readonly repository: readonly string[] | null;
  readonly author: AskedValue;
  readonly type: AskedValue;
  readonly state: AskedValue;
  readonly week: AskedValue;
  readonly reverted: AskedValue;
  readonly rounds: AskedValue;
  readonly compared: AskedValue;
}

export interface PullRequestFilter {
  readonly repositories: readonly string[] | null;
  readonly author: PullRequestAuthor | null;
  readonly type: PullRequestType | null;
  readonly state: DeliveryState | null;
  readonly week: Window | null;
  readonly reverted: boolean;
  readonly rounds: RoundBucket | null;
  readonly compared: boolean;
}

const WEEK = /^\d{4}-\d{2}-\d{2}$/;

const FLAGS = ['true', 'false'] as const;

const single = (asked: AskedValue, what: string): string | null => {
  if (typeof asked === 'string' || asked === null) {
    return asked;
  }

  throw new InvalidPullRequestFilterError(
    `by one ${what} at a time, not ${asked.length}`,
  );
};

const oneOf = <T extends string>(
  values: readonly T[],
  value: AskedValue,
  what: string,
): T | null => {
  const asked = single(value, what);

  if (asked === null) {
    return null;
  }

  const found = values.find((each) => each === asked);

  if (!found) {
    throw new InvalidPullRequestFilterError(
      `by one ${what} of ${values.join(', ')}, not ${asked}`,
    );
  }

  return found;
};

const flagOf = (asked: AskedValue, what: string): boolean =>
  oneOf(FLAGS, asked, what) === 'true';

const weekOf = (value: AskedValue): Window | null => {
  const asked = single(value, 'week');

  if (asked === null) {
    return null;
  }

  const window = WEEK.test(asked) ? weekWindowOf(asked) : null;

  if (!window || Number.isNaN(window.from.getTime())) {
    throw new InvalidPullRequestFilterError(
      `by a week that starts on a day written YYYY-MM-DD, not ${asked}`,
    );
  }

  return window;
};

const repositoriesOf = (
  asked: readonly string[] | null,
): readonly string[] | null => {
  if (asked !== null && asked.length > MOST_FILTERED_REPOSITORIES) {
    throw new InvalidPullRequestFilterError(
      `by at most ${MOST_FILTERED_REPOSITORIES} repositories at once`,
    );
  }

  return asked;
};

export const pullRequestFilterOf = (
  asked: PullRequestFilterAsked,
): PullRequestFilter => ({
  repositories: repositoriesOf(asked.repository),
  author: oneOf(PULL_REQUEST_AUTHORS, asked.author, 'author'),
  type: oneOf(PULL_REQUEST_TYPES, asked.type, 'type'),
  state: oneOf(DELIVERY_STATES, asked.state, 'state'),
  week: weekOf(asked.week),
  reverted: flagOf(asked.reverted, 'reverted'),
  rounds: oneOf(ROUND_BUCKETS, asked.rounds, 'count of review rounds'),
  compared: flagOf(asked.compared, 'compared'),
});

const activeWithin = (each: TeamPullRequest, window: Window): boolean =>
  within(window, each.seen.openedAt) ||
  within(window, each.seen.closedAt) ||
  (each.seen.state === 'open' &&
    each.seen.openedAt.getTime() < window.to.getTime());

const inState = (
  each: TeamPullRequest,
  state: DeliveryState | null,
  window: Window,
): boolean => {
  if (state === null) {
    return activeWithin(each, window);
  }

  if (state === 'open') {
    return (
      each.seen.state === 'open' &&
      each.seen.openedAt.getTime() < window.to.getTime()
    );
  }

  return each.seen.state === state && within(window, each.seen.closedAt);
};

const lastAt = (each: TeamPullRequest): number =>
  (each.seen.closedAt ?? each.seen.openedAt).getTime();

const inAny = (
  each: TeamPullRequest,
  repositories: readonly string[] | null,
): boolean =>
  repositories === null ||
  repositories.some((repository) =>
    sameRepository(repository, each.seen.repository),
  );

export const filteredPullRequests = (
  pullRequests: readonly TeamPullRequest[],
  filter: PullRequestFilter,
  window: Window,
): readonly TeamPullRequest[] => {
  const compared = filter.compared
    ? comparedRepositoriesOf(pullRequests, window)
    : null;

  return pullRequests
    .filter(
      (each) =>
        inState(each, filter.state, window) &&
        (filter.week === null || within(filter.week, each.seen.closedAt)) &&
        inAny(each, filter.repositories) &&
        inAny(each, compared) &&
        (filter.author === null || each.by === filter.author) &&
        (filter.type === null || each.type === filter.type) &&
        (!filter.reverted || reverted(each)) &&
        (filter.rounds === null ||
          roundBucketOf(each.seen.reviewRounds) === filter.rounds),
    )
    .sort(
      (a, b) =>
        lastAt(b) - lastAt(a) || a.pullRequest.localeCompare(b.pullRequest),
    );
};
