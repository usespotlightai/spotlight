import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidHarnessVersionError extends DomainError {
  readonly kind = 'internal' as const;

  constructor(readonly because: string) {
    super(`Harness version ${because}.`);
    this.name = 'InvalidHarnessVersionError';
  }
}
