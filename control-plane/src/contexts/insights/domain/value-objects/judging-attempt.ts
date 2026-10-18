const JUDGING_ATTEMPTS = [1, 2] as const;

export type JudgingAttempt = (typeof JUDGING_ATTEMPTS)[number];

export const isJudgingAttempt = (value: number): value is JudgingAttempt =>
  (JUDGING_ATTEMPTS as readonly number[]).includes(value);
