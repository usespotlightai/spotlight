import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunOrderConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(`Run ${id} was already ordered with another order.`);
    this.name = 'RunOrderConflictError';
  }
}
