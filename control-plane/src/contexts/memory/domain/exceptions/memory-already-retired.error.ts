import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class MemoryAlreadyRetiredError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(`Memory ${id} is already retired.`);
    this.name = 'MemoryAlreadyRetiredError';
  }
}
