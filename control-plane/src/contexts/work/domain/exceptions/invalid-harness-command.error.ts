import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidHarnessCommandError extends DomainError {
  readonly kind = 'internal' as const;

  constructor(reason: string) {
    super(`Harness command ${reason}.`);
    this.name = 'InvalidHarnessCommandError';
  }
}
