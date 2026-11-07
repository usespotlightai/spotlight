import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidHarnessSessionError extends DomainError {
  readonly kind = 'internal' as const;

  constructor(reason: string) {
    super(`Harness session ${reason}.`);
    this.name = 'InvalidHarnessSessionError';
  }
}
