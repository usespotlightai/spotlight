import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InconsistentStateError extends DomainError {
  readonly kind = 'internal' as const;

  constructor(aggregate: string, reason: string) {
    super(`A stored ${aggregate} ${reason}`);
    this.name = 'InconsistentStateError';
  }
}
