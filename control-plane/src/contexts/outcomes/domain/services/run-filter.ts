import { InvalidRunFilterError } from '@outcomes/domain/exceptions/invalid-run-filter.error';
import { weekWindowOf } from '@outcomes/domain/services/pull-request-insights';
import {
  DELIVERY_STATES,
  type DeliveryState,
} from '@outcomes/domain/value-objects/delivery-state';
import {
  type Window,
  within,
} from '@outcomes/domain/value-objects/insights-period.vo';
import {
  NEXT_ACTS,
  type NextActKind,
} from '@outcomes/domain/value-objects/next-act.vo';
import {
  RUN_ENDINGS,
  type RunEnding,
} from '@outcomes/domain/value-objects/run-ending';

export const HARNESS_DEFAULT_MODEL = '~default';

export const NO_REPOSITORY = 'none';

export const NO_SERVER = 'none';

const LONGEST_FILTER = 200;

export const MOST_FILTERED_TASKS = 200;

type AskedValue = string | readonly string[] | null;

export interface RunFilterAsked {
  readonly lineId: AskedValue;
  readonly stationId: AskedValue;
  readonly outcome: AskedValue;
  readonly harness: AskedValue;
  readonly model: AskedValue;
  readonly repository: AskedValue;
  readonly fingerprint: AskedValue;
  readonly taskId: AskedValue;
  readonly taskIds: readonly string[] | null;
  readonly personId: AskedValue;
  readonly day: AskedValue;
  readonly week: AskedValue;
  readonly skillGiven: AskedValue;
  readonly skillUsed: AskedValue;
  readonly server: AskedValue;
  readonly serverFailed: AskedValue;
  readonly failedAfter: AskedValue;
  readonly refusedTool: AskedValue;
  readonly refusedServer: AskedValue;
  readonly delivery: AskedValue;
  readonly next: AskedValue;
  readonly asked: AskedValue;
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
  readonly skillGiven: string | null;
  readonly skillUsed: string | null;
  readonly server: string | null;
  readonly serverFailed: string | null;
  readonly failedAfter: string | null;
  readonly refusedTool: string | null;
  readonly refusedServer: Narrowing;
  readonly delivery: DeliveryState | null;
  readonly next: NextActKind | null;
  readonly askedWithin: Window | null;
}

const single = (asked: AskedValue, what: string): string | null => {
  if (typeof asked === 'string' && asked.length > LONGEST_FILTER) {
    throw new InvalidRunFilterError(
      `by a ${what} of at most ${LONGEST_FILTER} characters`,
    );
  }
  if (typeof asked === 'string' || asked === null) {
    return asked;
  }

  throw new InvalidRunFilterError(
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
    throw new InvalidRunFilterError(
      `by one ${what} of ${values.join(', ')}, not ${asked}`,
    );
  }

  return found;
};

const FLAGS = ['true', 'false'] as const;

const narrowingOf = (
  value: AskedValue,
  none: string,
  what: string,
): Narrowing => {
  const asked = single(value, what);

  if (asked === null) {
    return { kind: 'any' };
  }

  return asked === none ? { kind: 'none' } : { kind: 'is', value: asked };
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 24 * 60 * 60 * 1000;

const MONDAY = 1;

const startOf = (asked: string): Date | null => {
  const from = DATE.test(asked) ? new Date(`${asked}T00:00:00.000Z`) : null;

  return from &&
    !Number.isNaN(from.getTime()) &&
    from.toISOString().slice(0, 10) === asked
    ? from
    : null;
};

const dayOf = (value: AskedValue, period: Window): Window | null => {
  const asked = single(value, 'day');

  if (asked === null) {
    return null;
  }

  const from = startOf(asked);

  if (!from || !within(period, from)) {
    throw new InvalidRunFilterError(
      `by a day of the period written YYYY-MM-DD, not ${asked}`,
    );
  }

  return { from, to: new Date(from.getTime() + DAY_MS) };
};

const weekOf = (value: AskedValue): Window | null => {
  const asked = single(value, 'week');

  if (asked === null) {
    return null;
  }

  const window = DATE.test(asked) ? weekWindowOf(asked) : null;
  const monday =
    window !== null &&
    !Number.isNaN(window.from.getTime()) &&
    window.from.toISOString().slice(0, 10) === asked &&
    window.from.getUTCDay() === MONDAY;

  if (!window || !monday) {
    throw new InvalidRunFilterError(
      `by a week that starts on a Monday written YYYY-MM-DD, not ${asked}`,
    );
  }

  return window;
};

const taskIdsOf = (asked: RunFilterAsked): readonly string[] | null => {
  if (asked.taskIds !== null && asked.taskIds.length > MOST_FILTERED_TASKS) {
    throw new InvalidRunFilterError(
      `by at most ${MOST_FILTERED_TASKS} tasks at once`,
    );
  }

  const taskId = single(asked.taskId, 'task');

  if (taskId === null) {
    return asked.taskIds === null ? null : [...new Set(asked.taskIds)];
  }

  return asked.taskIds === null || asked.taskIds.includes(taskId)
    ? [taskId]
    : [];
};

const askedWithinOf = (value: AskedValue, period: Window): Window | null =>
  oneOf(FLAGS, value, 'answer to whether the task asked') === 'true'
    ? period
    : null;

export const runFilterOf = (
  asked: RunFilterAsked,
  period: Window,
): RunFilter => ({
  lineId: single(asked.lineId, 'line'),
  stationId: single(asked.stationId, 'station'),
  outcome: oneOf(RUN_ENDINGS, asked.outcome, 'outcome'),
  harness: single(asked.harness, 'harness'),
  model: narrowingOf(asked.model, HARNESS_DEFAULT_MODEL, 'model'),
  repository: narrowingOf(asked.repository, NO_REPOSITORY, 'repository'),
  fingerprint: single(asked.fingerprint, 'station config'),
  taskIds: taskIdsOf(asked),
  personId: single(asked.personId, 'person'),
  day: dayOf(asked.day, period),
  week: weekOf(asked.week),
  skillGiven: single(asked.skillGiven, 'skill given'),
  skillUsed: single(asked.skillUsed, 'skill used'),
  server: single(asked.server, 'server'),
  serverFailed: single(asked.serverFailed, 'server that failed'),
  failedAfter: single(asked.failedAfter, 'server failed after'),
  refusedTool: single(asked.refusedTool, 'refused tool'),
  refusedServer: narrowingOf(asked.refusedServer, NO_SERVER, 'refused server'),
  delivery: oneOf(DELIVERY_STATES, asked.delivery, 'delivery'),
  next: oneOf(NEXT_ACTS, asked.next, 'next act'),
  askedWithin: askedWithinOf(asked.asked, period),
});
