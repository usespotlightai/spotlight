import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidAssistSessionError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`An assist session ${reason}.`);
    this.name = 'InvalidAssistSessionError';
  }
}
