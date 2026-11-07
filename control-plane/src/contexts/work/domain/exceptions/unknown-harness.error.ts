import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownHarnessError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(id: string) {
    super(`Harness ${id} not found.`);
    this.name = 'UnknownHarnessError';
  }
}
