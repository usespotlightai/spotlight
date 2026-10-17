const JUDGING_ROUNDS = [1, 2] as const;

export type JudgingRound = (typeof JUDGING_ROUNDS)[number];

export const isJudgingRound = (value: number): value is JudgingRound =>
  (JUDGING_ROUNDS as readonly number[]).includes(value);
