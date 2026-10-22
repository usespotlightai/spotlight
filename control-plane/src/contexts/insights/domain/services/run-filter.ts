import { InvalidRunFilterError } from '@insights/domain/exceptions/invalid-run-filter.error';
import { weekWindowOf } from '@insights/domain/services/pull-request-insights';
import {
  TASK_ACTIONS,
  type TaskAction,
} from '@insights/domain/value-objects/human-action.vo';
import {
  type Window,
  within,
} from '@insights/domain/value-objects/insights-period.vo';
import {
  RUN_ENDINGS,
  type RunEnding,
} from '@insights/domain/value-objects/run-ending';
import {
  TASK_PULL_REQUEST_STATES,
  type TaskPullRequestState,
} from '@insights/domain/value-objects/task-pull-request-state';

export const HARNESS_DEFAULT_MODEL = '~default';

export const NO_REPOSITORY = 'none';

export const NO_SERVER = 'none';

const LONGEST_FILTER = 200;

export const MAX_FILTERED_TASKS = 200;

type QueryValue = string | readonly string[] | null;

export interface RunFilterQuery {
  readonly lineId: QueryValue;
  readonly stationId: QueryValue;
  readonly outcome: QueryValue;
  readonly harness: QueryValue;
  readonly model: QueryValue;
  readonly repository: QueryValue;
  readonly fingerprint: QueryValue;
  readonly taskId: QueryValue;
  readonly taskIds: readonly string[] | null;
  readonly personId: QueryValue;
  readonly day: QueryValue;
  readonly week: QueryValue;
  readonly skillEnabled: QueryValue;
  readonly skillUsed: QueryValue;
  readonly server: QueryValue;
  readonly serverFailed: QueryValue;
  readonly failedAfter: QueryValue;
  readonly dismissedTool: QueryValue;
  readonly dismissedServer: QueryValue;
  readonly pullRequestState: QueryValue;
  readonly humanAction: QueryValue;
  readonly asked: QueryValue;
}

export type Narrowing =
  | { readonly kind: 'any' }
  | { readonly kind: 'none' }
  | { readonly kind: 'is'; readonly value: string };

export interface RunFilter {
  readonly lineId: string | null;
  readonly stationId: string | null;
  readonly outcome: RunEnding | null;
  readonly harness: string | null;
  readonly model: Narrowing;
  readonly repository: Narrowing;
  readonly fingerprint: string | null;
  readonly taskIds: readonly string[] | null;
  readonly personId: string | null;
  readonly day: Window | null;
  readonly week: Window | null;
  readonly skillEnabled: string | null;
  readonly skillUsed: string | null;
  readonly server: string | null;
  readonly serverFailed: string | null;
  readonly failedAfter: string | null;
  readonly dismissedTool: string | null;
  readonly dismissedServer: Narrowing;
  readonly pullRequestState: TaskPullRequestState | null;
  readonly humanAction: TaskAction | null;
  readonly askedWithin: Window | null;
}

const single = (query: QueryValue, what: string): string | null => {
  if (typeof query === 'string' && query.length > LONGEST_FILTER) {
    throw new InvalidRunFilterError(
      `${what} must be at most ${LONGEST_FILTER} characters`,
    );
  }
  if (typeof query === 'string' || query === null) {
    return query;
  }

  throw new InvalidRunFilterError(`takes one ${what}, not ${query.length}`);
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
    throw new InvalidRunFilterError(
      `${what} must be one of ${values.join(', ')}, not ${query}`,
    );
  }

  return found;
};

const FLAGS = ['true', 'false'] as const;

const narrowingOf = (
  value: QueryValue,
  none: string,
  what: string,
): Narrowing => {
  const query = single(value, what);

  if (query === null) {
    return { kind: 'any' };
  }

  return query === none ? { kind: 'none' } : { kind: 'is', value: query };
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 24 * 60 * 60 * 1000;

const MONDAY = 1;

const startOf = (value: string): Date | null => {
  const from = DATE.test(value) ? new Date(`${value}T00:00:00.000Z`) : null;

  return from &&
    !Number.isNaN(from.getTime()) &&
    from.toISOString().slice(0, 10) === value
    ? from
    : null;
};

const dayOf = (value: QueryValue, period: Window): Window | null => {
  const query = single(value, 'day');

  if (query === null) {
    return null;
  }

  const from = startOf(query);

  if (!from || !within(period, from)) {
    throw new InvalidRunFilterError(
      `day must be a date in the period, in the form YYYY-MM-DD, not ${query}`,
    );
  }

  return { from, to: new Date(from.getTime() + DAY_MS) };
};

const weekOf = (value: QueryValue): Window | null => {
  const query = single(value, 'week');

  if (query === null) {
    return null;
  }

  const window = DATE.test(query) ? weekWindowOf(query) : null;
  const monday =
    window !== null &&
    !Number.isNaN(window.from.getTime()) &&
    window.from.toISOString().slice(0, 10) === query &&
    window.from.getUTCDay() === MONDAY;

  if (!window || !monday) {
    throw new InvalidRunFilterError(
      `week must be a Monday in the form YYYY-MM-DD, not ${query}`,
    );
  }

  return window;
};

const taskIdsOf = (query: RunFilterQuery): readonly string[] | null => {
  if (query.taskIds !== null && query.taskIds.length > MAX_FILTERED_TASKS) {
    throw new InvalidRunFilterError(
      `takes at most ${MAX_FILTERED_TASKS} tasks`,
    );
  }

  const taskId = single(query.taskId, 'task');

  if (taskId === null) {
    return query.taskIds === null ? null : [...new Set(query.taskIds)];
  }

  return query.taskIds === null || query.taskIds.includes(taskId)
    ? [taskId]
    : [];
};

const askedWithinOf = (value: QueryValue, period: Window): Window | null =>
  oneOf(FLAGS, value, 'answer to whether the task asked') === 'true'
    ? period
    : null;

export const runFilterOf = (
  query: RunFilterQuery,
  period: Window,
): RunFilter => ({
  lineId: single(query.lineId, 'line'),
  stationId: single(query.stationId, 'station'),
  outcome: oneOf(RUN_ENDINGS, query.outcome, 'outcome'),
  harness: single(query.harness, 'harness'),
  model: narrowingOf(query.model, HARNESS_DEFAULT_MODEL, 'model'),
  repository: narrowingOf(query.repository, NO_REPOSITORY, 'repository'),
  fingerprint: single(query.fingerprint, 'station config'),
  taskIds: taskIdsOf(query),
  personId: single(query.personId, 'person'),
  day: dayOf(query.day, period),
  week: weekOf(query.week),
  skillEnabled: single(query.skillEnabled, 'skill enabled'),
  skillUsed: single(query.skillUsed, 'skill used'),
  server: single(query.server, 'server'),
  serverFailed: single(query.serverFailed, 'server that failed'),
  failedAfter: single(query.failedAfter, 'server failed after'),
  dismissedTool: single(query.dismissedTool, 'dismissed tool'),
  dismissedServer: narrowingOf(
    query.dismissedServer,
    NO_SERVER,
    'dismissed server',
  ),
  pullRequestState: oneOf(
    TASK_PULL_REQUEST_STATES,
    query.pullRequestState,
    'pull request state',
  ),
  humanAction: oneOf(TASK_ACTIONS, query.humanAction, 'human action'),
  askedWithin: askedWithinOf(query.asked, period),
});

export const narrowsEndedOnly = (filter: RunFilter): boolean =>
  filter.outcome !== null ||
  filter.model.kind !== 'any' ||
  filter.repository.kind !== 'any' ||
  filter.fingerprint !== null ||
  filter.day !== null ||
  filter.week !== null ||
  filter.skillEnabled !== null ||
  filter.skillUsed !== null ||
  filter.server !== null ||
  filter.serverFailed !== null ||
  filter.failedAfter !== null ||
  filter.dismissedTool !== null ||
  filter.dismissedServer.kind !== 'any' ||
  filter.pullRequestState !== null ||
  filter.humanAction !== null ||
  filter.askedWithin !== null;

export const EVERY_RUN: RunFilter = {
  lineId: null,
  stationId: null,
  outcome: null,
  harness: null,
  model: { kind: 'any' },
  repository: { kind: 'any' },
  fingerprint: null,
  taskIds: null,
  personId: null,
  day: null,
  week: null,
  skillEnabled: null,
  skillUsed: null,
  server: null,
  serverFailed: null,
  failedAfter: null,
  dismissedTool: null,
  dismissedServer: { kind: 'any' },
  pullRequestState: null,
  humanAction: null,
  askedWithin: null,
};
