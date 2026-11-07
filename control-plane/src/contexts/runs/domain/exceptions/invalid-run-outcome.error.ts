import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRunOutcomeError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Run outcome ${reason}.`);
    this.name = 'InvalidRunOutcomeError';
  }
}
