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
  PULL_REQUEST_STATES,
  type PullRequestState,
} from '@insights/domain/value-objects/pull-request-state';
import {
  RUN_ENDINGS,
  type RunEnding,
} from '@insights/domain/value-objects/run-ending';

export const MAX_FILTERED_TASKS = 200;

export type Narrowing =
  | { readonly kind: 'any' }
  | { readonly kind: 'none' }
  | { readonly kind: 'is'; readonly value: string };

export interface RunFilterInput {
  readonly lineId: string | null;
  readonly stationId: string | null;
  readonly outcome: string | null;
  readonly harness: string | null;
  readonly model: Narrowing;
  readonly repository: Narrowing;
  readonly fingerprint: string | null;
  readonly taskId: string | null;
  readonly taskIds: readonly string[] | null;
  readonly personId: string | null;
  readonly day: string | null;
  readonly week: string | null;
  readonly skillEnabled: string | null;
  readonly skillUsed: string | null;
  readonly server: string | null;
  readonly serverFailed: string | null;
  readonly failedAfter: string | null;
  readonly dismissedTool: string | null;
  readonly dismissedServer: Narrowing;
  readonly pullRequestState: string | null;
  readonly humanAction: string | null;
  readonly asked: boolean;
}

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
  readonly pullRequestState: PullRequestState | null;
  readonly humanAction: TaskAction | null;
  readonly askedWithin: Window | null;
}

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
    throw new InvalidRunFilterError(
      `${what} must be one of ${values.join(', ')}, not ${query}`,
    );
  }

  return found;
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

const dayOf = (query: string | null, period: Window): Window | null => {
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

const weekOf = (query: string | null): Window | null => {
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

const taskIdsOf = (query: RunFilterInput): readonly string[] | null => {
  if (query.taskIds !== null && query.taskIds.length > MAX_FILTERED_TASKS) {
    throw new InvalidRunFilterError(
      `takes at most ${MAX_FILTERED_TASKS} tasks`,
    );
  }

  const { taskId } = query;

  if (taskId === null) {
    return query.taskIds === null ? null : [...new Set(query.taskIds)];
  }

  return query.taskIds === null || query.taskIds.includes(taskId)
    ? [taskId]
    : [];
};

export const runFilterOf = (
  input: RunFilterInput,
  period: Window,
): RunFilter => ({
  lineId: input.lineId,
  stationId: input.stationId,
  outcome: oneOf(RUN_ENDINGS, input.outcome, 'outcome'),
  harness: input.harness,
  model: input.model,
  repository: input.repository,
  fingerprint: input.fingerprint,
  taskIds: taskIdsOf(input),
  personId: input.personId,
  day: dayOf(input.day, period),
  week: weekOf(input.week),
  skillEnabled: input.skillEnabled,
  skillUsed: input.skillUsed,
  server: input.server,
  serverFailed: input.serverFailed,
  failedAfter: input.failedAfter,
  dismissedTool: input.dismissedTool,
  dismissedServer: input.dismissedServer,
  pullRequestState: oneOf(
    PULL_REQUEST_STATES,
    input.pullRequestState,
    'pull request state',
  ),
  humanAction: oneOf(TASK_ACTIONS, input.humanAction, 'human action'),
  askedWithin: input.asked ? period : null,
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
