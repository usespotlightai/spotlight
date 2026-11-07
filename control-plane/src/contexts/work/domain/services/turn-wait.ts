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

const crossed = (at: number, was: number, age: number): boolean =>
  was < at && at <= age;

export const TurnWait = {
  TURN_WAIT_MS: 3 * MINUTE_MS,

  ANSWER_GRACE_MS: 45 * MINUTE_MS,

  ABANDONED_AFTER_MS: DAY_MS,

  holdsHappening(turn: 'pending' | 'kept' | null, ageMs: number): boolean {
    return turn === 'pending' && ageMs < TurnWait.TURN_WAIT_MS;
  },

  firstRetakeAfter(now: Date): Date {
    return new Date(now.getTime() - RETAKES_AT_MS[0]);
  },

  retakesBetween(wasMs: number, ageMs: number): boolean {
    return RETAKES_AT_MS.some((at) => crossed(at, wasMs, ageMs));
  },

  givesUpBetween(wasMs: number, ageMs: number): boolean {
    return crossed(GIVES_UP_AT_MS, wasMs, ageMs);
  },

  answeredResumeUntil(now: Date): Date {
    return new Date(now.getTime() - 2 * DAY_MS);
  },
};
