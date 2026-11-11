import { InvalidRunFilterError } from '@insights/domain/exceptions/invalid-run-filter.error';
import type {
  Narrowing,
  RunFilterInput,
} from '@insights/domain/services/run-filter';

export const HARNESS_DEFAULT_MODEL = '~default';

export const NO_REPOSITORY = 'none';

export const NO_SERVER = 'none';

const LONGEST_FILTER = 200;

const FLAGS = ['true', 'false'] as const;

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
  readonly resolution: QueryValue;
  readonly asked: QueryValue;
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

const flagOf = (value: QueryValue, what: string): boolean => {
  const query = single(value, what);

  if (query !== null && !FLAGS.some((each) => each === query)) {
    throw new InvalidRunFilterError(
      `${what} must be one of ${FLAGS.join(', ')}, not ${query}`,
    );
  }

  return query === 'true';
};

export const runFilterInputOf = (query: RunFilterQuery): RunFilterInput => ({
  lineId: single(query.lineId, 'line'),
  stationId: single(query.stationId, 'station'),
  outcome: single(query.outcome, 'outcome'),
  harness: single(query.harness, 'harness'),
  model: narrowingOf(query.model, HARNESS_DEFAULT_MODEL, 'model'),
  repository: narrowingOf(query.repository, NO_REPOSITORY, 'repository'),
  fingerprint: single(query.fingerprint, 'station config'),
  taskId: single(query.taskId, 'task'),
  taskIds: query.taskIds,
  personId: single(query.personId, 'person'),
  day: single(query.day, 'day'),
  week: single(query.week, 'week'),
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
  pullRequestState: single(query.pullRequestState, 'pull request state'),
  humanAction: single(query.humanAction, 'human action'),
  resolution: single(query.resolution, 'resolution'),
  asked: flagOf(query.asked, 'answer to whether the task asked'),
});
