import type { OriginalOutcome } from '@replays/domain/services/composition';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export type OracleAnswer = Extract<OriginalOutcome, 'accepted' | 'sent-back'>;

export const oracleAnswerOf = (
  outcome: OriginalOutcome | undefined,
): OracleAnswer | null =>
  outcome === 'accepted' || outcome === 'sent-back' ? outcome : null;

export interface OracleAnswered {
  readonly run: RunId;
  readonly answer: OracleAnswer;
}
