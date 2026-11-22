import {
  DECISION_LIMITS,
  type DecisionRefusal,
} from '@change-review/domain/services/decision-policy';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

const REASONS: Record<DecisionRefusal, string> = {
  'works-no-task':
    'Only a run of a task records decisions, and this run works no task of its own.',
  'station-keeps-none':
    'The station of this run keeps no decisions. Turn decisions on for the station to record them.',
  'reviews-pull-request':
    'A task that reviews a pull request keeps no decisions.',
  'task-merged':
    'The task merged, so its decisions are final. Record decisions before the pull request merges.',
  'task-full': `The task keeps at most ${DECISION_LIMITS.perTask} decisions. Record only the decisions that shaped the change.`,
};

export class DecisionsRefusedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(readonly refusal: DecisionRefusal) {
    super(REASONS[refusal]);
    this.name = 'DecisionsRefusedError';
  }
}
