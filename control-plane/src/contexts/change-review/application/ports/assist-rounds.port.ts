import type { DraftingRound } from '@change-review/domain/value-objects/drafting-round.vo';
import type { GradingRound } from '@change-review/domain/value-objects/grading-round.vo';

export const ASSIST_ROUNDS = Symbol('ASSIST_ROUNDS');

/** The round of change review that an assist session ran. */
export type SessionRound =
  | { readonly of: 'drafting'; readonly round: DraftingRound }
  | { readonly of: 'grading'; readonly round: GradingRound };

export interface AssistSession {
  readonly purpose: string;
  readonly key: string;
}

export interface AssistRoundsPort {
  /** The round a session ran, or null when change review did not order it. */
  roundOf(session: AssistSession): SessionRound | null;
}
