import type { RunReasoning } from '@change-review/application/ports/work.port';
import type { ProposedDecision } from '@change-review/domain/entities/decision.entity';

export const DECISION_DRAFTER = Symbol('DECISION_DRAFTER');

export interface DecisionDrafterPort {
  readonly available: boolean;

  draft(reasoning: RunReasoning): Promise<readonly ProposedDecision[]>;
}
