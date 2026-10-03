const JUDGING_ROUNDS = [1, 2] as const;

export type JudgingRound = (typeof JUDGING_ROUNDS)[number];

export const isJudgingRound = (held: number): held is JudgingRound =>
  (JUDGING_ROUNDS as readonly number[]).includes(held);
