import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownUpkeepError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(id: string) {
    super(`Memory upkeep ${id} not found.`);
    this.name = 'UnknownUpkeepError';
  }
}
