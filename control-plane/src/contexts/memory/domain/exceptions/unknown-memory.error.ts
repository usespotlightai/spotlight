import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownMemoryError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(id: string) {
    super(`Memory ${id} not found.`);
    this.name = 'UnknownMemoryError';
  }
}
