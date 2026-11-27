const MINUTE_MS = 60_000;

const HOUR_MS = 60 * MINUTE_MS;

export const HOOK_DELIVERY_LOOKBACK_MS = 3 * 24 * HOUR_MS;

export const MAX_REDELIVERIES = 10;

const FIRST_WAIT_MS = MINUTE_MS;

const LONGEST_WAIT_MS = HOUR_MS;

const TIMED_OUT = 408;

const TOO_MANY = 429;

const SERVER_ERROR = 500;

export type HookDeliveryOutcome = 'delivered' | 'transient' | 'refused';

export interface HookDeliveryHistory {
  readonly firstAt: Date;
  readonly lastAt: Date;
  readonly lastOutcome: HookDeliveryOutcome;
  readonly attempts: number;
  readonly requests: number;
  readonly requestedAt: Date | null;
}

export const outcomeOf = (statusCode: number | null): HookDeliveryOutcome => {
  if (statusCode !== null && statusCode >= 200 && statusCode < 300) {
    return 'delivered';
  }

  return statusCode === null ||
    statusCode === 0 ||
    statusCode === TIMED_OUT ||
    statusCode === TOO_MANY ||
    statusCode >= SERVER_ERROR
    ? 'transient'
    : 'refused';
};

const redeliveriesOf = (history: HookDeliveryHistory): number =>
  Math.max(history.attempts - 1, history.requests);

export const exhausted = (history: HookDeliveryHistory): boolean =>
  redeliveriesOf(history) >= MAX_REDELIVERIES;

const waitBefore = (redeliveries: number): number =>
  Math.min(FIRST_WAIT_MS * 2 ** redeliveries, LONGEST_WAIT_MS);

export const redeliveryDue = (
  history: HookDeliveryHistory,
  now: Date,
): boolean => {
  if (
    history.lastOutcome !== 'transient' ||
    exhausted(history) ||
    history.firstAt.getTime() < now.getTime() - HOOK_DELIVERY_LOOKBACK_MS
  ) {
    return false;
  }

  const touched = Math.max(
    history.lastAt.getTime(),
    history.requestedAt?.getTime() ?? 0,
  );

  return now.getTime() >= touched + waitBefore(redeliveriesOf(history));
};
