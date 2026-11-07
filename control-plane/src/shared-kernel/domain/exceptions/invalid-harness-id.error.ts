import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidHarnessIdError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Harness id ${reason}.`);
    this.name = 'InvalidHarnessIdError';
  }
}
