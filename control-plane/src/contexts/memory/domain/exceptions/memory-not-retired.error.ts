import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class MemoryNotRetiredError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(`Memory ${id} is not retired.`);
    this.name = 'MemoryNotRetiredError';
  }
}
