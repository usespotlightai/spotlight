import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidHarnessModelError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Harness model ${reason}.`);
    this.name = 'InvalidHarnessModelError';
  }
}
