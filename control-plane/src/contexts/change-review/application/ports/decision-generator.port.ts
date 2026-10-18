import type { RunReasoning } from '@change-review/application/ports/work.port';
import type { ProposedDecision } from '@change-review/domain/entities/decision.entity';

export const DECISION_GENERATOR = Symbol('DECISION_GENERATOR');

export interface DecisionGeneratorPort {
  readonly available: boolean;

  generate(reasoning: RunReasoning): Promise<readonly ProposedDecision[]>;
}
