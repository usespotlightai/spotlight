import type { DecisionField } from '@change-review/domain/entities/decision.entity';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidDecisionError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    reason: string,
    subject = 'decision',
    readonly field: DecisionField | null = null,
  ) {
    super(`A ${subject} ${reason}.`);
    this.name = 'InvalidDecisionError';
  }

  static at(field: DecisionField, reason: string): InvalidDecisionError {
    return new InvalidDecisionError(reason, 'decision', field);
  }

  static ofSet(reason: string): InvalidDecisionError {
    return new InvalidDecisionError(reason, 'decision set');
  }
}
