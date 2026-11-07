import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidHarnessNameError extends DomainError {
  readonly kind = 'internal' as const;

  constructor(reason: string) {
    super(`Harness name ${reason}.`);
    this.name = 'InvalidHarnessNameError';
  }
}
