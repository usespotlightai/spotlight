import type { TurnStatus } from '@work/domain/value-objects/turn-status';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const RETAKES_AT_MS = [
  45 * MINUTE_MS,
  90 * MINUTE_MS,
  3 * HOUR_MS,
  6 * HOUR_MS,
  12 * HOUR_MS,
  DAY_MS,
] as const;

const GIVES_UP_AT_MS = DAY_MS;

const RETAKES_KEPT_MS = 7 * DAY_MS;

export interface TurnCheck {
  readonly retakes: boolean;
  readonly givesUp: boolean;
}

const crossed = (at: number, was: number, age: number): boolean =>
  was < at && at <= age;

export const TurnWait = {
  TURN_WAIT_MS: 3 * MINUTE_MS,

  ANSWER_GRACE_MS: 45 * MINUTE_MS,

  ABANDONED_AFTER_MS: DAY_MS,

  holdsHappening(turn: TurnStatus | null, ageMs: number): boolean {
    return turn === 'pending' && ageMs < TurnWait.TURN_WAIT_MS;
  },

  firstRetakeAfter(now: Date): Date {
    return new Date(now.getTime() - RETAKES_AT_MS[0]);
  },

  retakesKeptAfter(now: Date): Date {
    return new Date(now.getTime() - RETAKES_KEPT_MS);
  },

  checkOf(suspendedAt: Date, checkedAt: Date | null, now: Date): TurnCheck {
    const age = now.getTime() - suspendedAt.getTime();
    const was = checkedAt ? checkedAt.getTime() - suspendedAt.getTime() : 0;

    return age >= RETAKES_KEPT_MS
      ? { retakes: false, givesUp: false }
      : {
          retakes: RETAKES_AT_MS.some((at) => crossed(at, was, age)),
          givesUp: crossed(GIVES_UP_AT_MS, was, age),
        };
  },

  answeredResumeUntil(now: Date): Date {
    return new Date(now.getTime() - 2 * DAY_MS);
  },
};
