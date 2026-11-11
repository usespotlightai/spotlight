import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidDecisionError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string, subject = 'decision') {
    super(`A ${subject} ${reason}.`);
    this.name = 'InvalidDecisionError';
  }

  static ofSet(reason: string): InvalidDecisionError {
    return new InvalidDecisionError(reason, 'decision set');
  }
}
