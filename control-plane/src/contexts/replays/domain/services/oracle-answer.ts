import type { OriginalOutcome } from '@replays/domain/services/composition';

export type OracleAnswer = Extract<OriginalOutcome, 'accepted' | 'sent-back'>;

export const oracleAnswerOf = (
  outcome: OriginalOutcome | undefined,
): OracleAnswer | null =>
  outcome === 'accepted' || outcome === 'sent-back' ? outcome : null;
