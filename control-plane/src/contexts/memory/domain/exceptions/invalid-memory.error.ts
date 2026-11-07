import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidMemoryError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string, subject = 'memory') {
    super(`A ${subject} ${reason}.`);
    this.name = 'InvalidMemoryError';
  }

  static ofDraft(reason: string): InvalidMemoryError {
    return new InvalidMemoryError(reason, 'memory draft');
  }
}
